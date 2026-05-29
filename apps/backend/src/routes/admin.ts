import { Router } from "express";
import { Prisma, WorkspaceKind, MembershipRole, SubscriptionStatus, BillingPeriod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { adminRequired } from "../middleware/auth";
import { prisma } from "../db";
import { processingQueue } from "../queue";
import { hashPassword } from "../lib/hash";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(120).optional(),
  isAdmin: z.boolean().optional().default(false),
  workspaceName: z.string().min(1).max(120).optional().default("My workspace"),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(120).nullable().optional(),
  isAdmin: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

const modelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  configJson: z.any().optional(),
});

const runsFilterSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "partial_failed"]).optional(),
  userId: z.string().min(1).optional(),
  userEmail: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  hasErrors: z.enum(["true", "false"]).optional(),
});

export const adminRouter = Router();

adminRouter.use(adminRequired);

// ── Дашборд ────────────────────────────────────────────────────────────────

adminRouter.get("/dashboard", async (_req, res) => {
  const [users, runStats, meetingStats, paymentStats, activeSubscriptions] = await Promise.all([
    prisma.user.findMany({
      where: { isArchivist: false },
      select: {
        id: true, email: true, name: true, isAdmin: true, isBlocked: true,
        accountType: true, loginCount: true, lastActiveAt: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.meetingProcessingRun.groupBy({
      by: ["userId"],
      where: { status: "completed" },
      _sum: { totalCost: true },
      _count: { _all: true },
    }),
    prisma.meeting.groupBy({
      by: ["createdByUserId"],
      _sum: { sourceDurationSec: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["userId"],
      where: { status: "success" },
      _sum: { amount: true },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ["free", "active", "trial", "grace"] } },
      include: { plan: { select: { name: true, code: true } } },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const runByUser = Object.fromEntries(runStats.map((r) => [r.userId, r]));
  const meetingByUser = Object.fromEntries(meetingStats.map((m) => [m.createdByUserId ?? "", m]));
  const paymentByUser = Object.fromEntries(paymentStats.map((p) => [p.userId, p]));
  const subByUser: Record<string, typeof activeSubscriptions[0]> = {};
  for (const sub of activeSubscriptions) {
    if (!subByUser[sub.userId]) subByUser[sub.userId] = sub;
  }

  const userRows = users.map((u) => {
    const runs = runByUser[u.id];
    const meetings = meetingByUser[u.id];
    const payments = paymentByUser[u.id];
    const sub = subByUser[u.id];
    const daysSinceReg = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000);

    return {
      ...u,
      daysSinceReg,
      meetingsProcessed: runs?._count._all ?? 0,
      audioHours: Math.round(((meetings?._sum.sourceDurationSec ?? 0) / 3600) * 10) / 10,
      aiCostUsd: Math.round((runs?._sum.totalCost ?? 0) * 100) / 100,
      paidRub: Math.round(payments?._sum.amount ?? 0),
      subscription: sub ? { status: sub.status, planName: sub.plan?.name ?? sub.planCode, expiresAt: sub.expiresAt } : null,
    };
  });

  const totals = {
    totalUsers: users.length,
    totalMeetingsProcessed: runStats.reduce((s, r) => s + r._count._all, 0),
    totalAiCostUsd: Math.round(runStats.reduce((s, r) => s + (r._sum.totalCost ?? 0), 0) * 100) / 100,
    totalPaidRub: Math.round(paymentStats.reduce((s, p) => s + (p._sum.amount ?? 0), 0)),
  };

  res.json({ totals, users: userRows });
});

// Журнал обработок — видны все запуски всех пользователей (§25)
adminRouter.get("/runs", async (req, res) => {
  const parsed = runsFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const where: Prisma.MeetingProcessingRunWhereInput = {};

  if (parsed.data.status) {
    where.status = parsed.data.status;
  }
  if (parsed.data.userId) {
    where.userId = parsed.data.userId;
  }
  if (parsed.data.userEmail) {
    where.user = { email: { contains: parsed.data.userEmail, mode: "insensitive" } };
  }
  if (parsed.data.from || parsed.data.to) {
    where.createdAt = {
      ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
      ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
    };
  }
  if (parsed.data.hasErrors === "true") {
    where.OR = [{ errorMessage: { not: null } }, { steps: { some: { status: "failed" } } }];
  }
  if (parsed.data.hasErrors === "false") {
    where.errorMessage = null;
    where.steps = { none: { status: "failed" } };
  }

  const runs = await prisma.meetingProcessingRun.findMany({
    where,
    include: {
      meeting: true,
      user: { select: { id: true, email: true, name: true } },
      _count: { select: { steps: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(runs);
});

// Карточка конкретного запуска (§26)
adminRouter.get("/runs/:runId", async (req, res) => {
  const run = await prisma.meetingProcessingRun.findFirst({
    where: { id: req.params.runId },
    include: {
      meeting: true,
      user: { select: { id: true, email: true, name: true } },
      steps: { orderBy: { startedAt: "asc" } },
    },
  });

  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  res.json(run);
});

// Ручной перезапуск обработки (§27)
adminRouter.post("/runs/:runId/rerun", async (req, res) => {
  const sourceRun = await prisma.meetingProcessingRun.findFirst({
    where: { id: req.params.runId },
    include: { meeting: true },
  });

  if (!sourceRun) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const run = await prisma.meetingProcessingRun.create({
    data: {
      meetingId: sourceRun.meetingId,
      userId: sourceRun.userId,
      workspaceId: sourceRun.workspaceId,
      status: "pending",
    },
  });

  await processingQueue.add(
    "process-meeting",
    { meetingId: sourceRun.meetingId, runId: run.id },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  res.status(202).json({ runId: run.id, status: "pending" });
});

// Просмотр всех конфигураций моделей (§20)
adminRouter.get("/models", async (_req, res) => {
  const configs = await prisma.aIModelConfig.findMany({
    orderBy: [{ purpose: "asc" }, { isActive: "desc" }, { createdAt: "desc" }],
  });
  res.json(configs);
});

// Активация конфигурации транскрипции (§20)
// При активации деактивируем все остальные того же типа, создаём новую или активируем существующую
adminRouter.put("/models/transcription", async (req, res) => {
  const payload = modelConfigSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  const config = await prisma.$transaction(async (tx) => {
    await tx.aIModelConfig.updateMany({
      where: { purpose: "transcription" },
      data: { isActive: false },
    });

    const existing = await tx.aIModelConfig.findFirst({
      where: {
        purpose: "transcription",
        provider: payload.data.provider,
        model: payload.data.model,
      },
    });

    if (existing) {
      return tx.aIModelConfig.update({
        where: { id: existing.id },
        data: { isActive: true, configJson: payload.data.configJson },
      });
    }

    return tx.aIModelConfig.create({
      data: {
        purpose: "transcription",
        provider: payload.data.provider,
        model: payload.data.model,
        isActive: true,
        configJson: payload.data.configJson,
      },
    });
  });

  res.json(config);
});

// Активация конфигурации постобработки (§20)
adminRouter.put("/models/postprocessing", async (req, res) => {
  const payload = modelConfigSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  const config = await prisma.$transaction(async (tx) => {
    await tx.aIModelConfig.updateMany({
      where: { purpose: "postprocessing" },
      data: { isActive: false },
    });

    const existing = await tx.aIModelConfig.findFirst({
      where: {
        purpose: "postprocessing",
        provider: payload.data.provider,
        model: payload.data.model,
      },
    });

    if (existing) {
      return tx.aIModelConfig.update({
        where: { id: existing.id },
        data: { isActive: true, configJson: payload.data.configJson },
      });
    }

    return tx.aIModelConfig.create({
      data: {
        purpose: "postprocessing",
        provider: payload.data.provider,
        model: payload.data.model,
        isActive: true,
        configJson: payload.data.configJson,
      },
    });
  });

  res.json(config);
});

// ── Управление пользователями ──────────────────────────────────────────────

// Список пользователей с поиском по email/имени
adminRouter.get("/users", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      isBlocked: true,
      lastActiveAt: true,
      loginCount: true,
      createdAt: true,
      _count: { select: { memberships: true, createdMeetings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(users);
});

// Создать пользователя (вместе с personal workspace)
adminRouter.post("/users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    res.status(409).json({ error: "Email уже зарегистрирован" });
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        isAdmin: parsed.data.isAdmin,
        passwordHash: await hashPassword(parsed.data.password),
        emailVerified: true,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: parsed.data.workspaceName,
        kind: WorkspaceKind.PERSONAL,
        personalOwnerUserId: newUser.id,
      },
    });

    await tx.membership.create({
      data: {
        userId: newUser.id,
        workspaceId: workspace.id,
        role: MembershipRole.OWNER,
      },
    });

    return newUser;
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  });
});

// Изменить пользователя (имя, email, права, пароль)
adminRouter.patch("/users/:userId", async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, name, isAdmin, isBlocked, password } = parsed.data;

  if (email) {
    const conflict = await prisma.user.findFirst({
      where: { email, NOT: { id: req.params.userId } },
    });
    if (conflict) {
      res.status(409).json({ error: "Email уже используется другим пользователем" });
      return;
    }
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (email !== undefined) updateData.email = email;
  if (name !== undefined) updateData.name = name;
  if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
  if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
  if (password) updateData.passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: updateData,
      select: { id: true, email: true, name: true, isAdmin: true, isBlocked: true, lastActiveAt: true, loginCount: true, createdAt: true },
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: "Пользователь не найден" });
  }
});

// Удалить пользователя — данные переносятся на архивариуса
adminRouter.delete("/users/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("NOT_FOUND");
      if (user.isArchivist) throw new Error("CANNOT_DELETE_ARCHIVIST");

      const archivist = await tx.user.findFirst({ where: { isArchivist: true } });
      if (!archivist) throw new Error("NO_ARCHIVIST");

      // Переносим встречи
      await tx.meeting.updateMany({
        where: { createdByUserId: userId },
        data: { createdByUserId: archivist.id },
      });

      // Переносим личный workspace: меняем владельца и пересоздаём членство
      const personalWorkspace = await tx.workspace.findFirst({
        where: { personalOwnerUserId: userId },
      });
      if (personalWorkspace) {
        await tx.workspace.update({
          where: { id: personalWorkspace.id },
          data: { personalOwnerUserId: null, originalOwnerEmail: user.email },
        });
        await tx.membership.deleteMany({ where: { workspaceId: personalWorkspace.id } });
        await tx.membership.create({
          data: { userId: archivist.id, workspaceId: personalWorkspace.id, role: MembershipRole.OWNER },
        });
      }

      // Удаляем оставшиеся членства пользователя (в чужих workspace)
      await tx.membership.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND")
      return res.status(404).json({ error: "Пользователь не найден" });
    if (err instanceof Error && err.message === "CANNOT_DELETE_ARCHIVIST")
      return res.status(403).json({ error: "Нельзя удалить архивариуса" });
    if (err instanceof Error && err.message === "NO_ARCHIVIST")
      return res.status(400).json({ error: "Сначала создайте аккаунт-архивариус" });
    res.status(500).json({ error: "Не удалось удалить пользователя" });
  }
});

// ── Архивариус ─────────────────────────────────────────────────────────────

// Получить архивариуса (для проверки существования)
adminRouter.get("/archivist/setup", async (_req, res) => {
  const archivist = await prisma.user.findFirst({ where: { isArchivist: true } });
  if (!archivist) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: archivist.id, email: archivist.email, name: archivist.name });
});

// Создать архивариуса
adminRouter.post("/archivist/setup", async (req, res) => {
  const existing = await prisma.user.findFirst({ where: { isArchivist: true } });
  if (existing) {
    return res.json({ id: existing.id, email: existing.email, name: existing.name });
  }

  const archivist = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: "archivist@system.internal",
        name: "Архивариус",
        passwordHash: "disabled",
        emailVerified: true,
        isArchivist: true,
        isBlocked: true,
      },
    });
    const workspace = await tx.workspace.create({
      data: { name: "Archive", kind: WorkspaceKind.PERSONAL, personalOwnerUserId: user.id },
    });
    await tx.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: MembershipRole.OWNER },
    });
    return user;
  });

  res.status(201).json({ id: archivist.id, email: archivist.email, name: archivist.name });
});

// ── Workspace управление ───────────────────────────────────────────────────

// Список всех workspace с владельцем (для переназначения)
adminRouter.get("/workspaces", async (_req, res) => {
  const archivist = await prisma.user.findFirst({ where: { isArchivist: true } });

  const workspaces = await prisma.workspace.findMany({
    where: { personalOwnerUserId: null, originalOwnerEmail: { not: null } },
    select: {
      id: true,
      name: true,
      originalOwnerEmail: true,
      createdAt: true,
      _count: { select: { meetings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(workspaces);
});

// Переназначить workspace другому пользователю
adminRouter.post("/workspaces/:workspaceId/transfer", async (req, res) => {
  const { targetUserId } = z.object({ targetUserId: z.string().min(1) }).parse(req.body);

  const [workspace, targetUser] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: req.params.workspaceId } }),
    prisma.user.findUnique({ where: { id: targetUserId } }),
  ]);

  if (!workspace) return res.status(404).json({ error: "Workspace не найден" });
  if (!targetUser) return res.status(404).json({ error: "Пользователь не найден" });
  if (targetUser.isArchivist) return res.status(400).json({ error: "Нельзя назначить архивариуса владельцем" });

  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: workspace.id },
      data: { personalOwnerUserId: targetUser.id },
    });
    await tx.membership.deleteMany({ where: { workspaceId: workspace.id } });
    await tx.membership.create({
      data: { userId: targetUser.id, workspaceId: workspace.id, role: MembershipRole.OWNER },
    });
  });

  res.json({ ok: true });
});

// ── Планы ─────────────────────────────────────────────────────────────────

adminRouter.get("/plans", async (_req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  res.json(plans);
});

// ── Подписки ───────────────────────────────────────────────────────────────

const assignSubscriptionSchema = z.object({
  planId: z.string().min(1),
  billingPeriod: z.enum(["monthly", "yearly"]).optional(),
  status: z.enum(["free", "trial", "active", "grace", "canceled", "expired"]).optional().default("active"),
  startedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  note: z.string().optional(),
  // Опциональная запись платежа
  paymentAmount: z.number().positive().optional(),
  paymentNote: z.string().optional(),
});

// Назначить подписку пользователю вручную
adminRouter.post("/users/:userId/subscriptions", async (req, res) => {
  const parsed = assignSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan) { res.status(404).json({ error: "Тариф не найден" }); return; }

  const { planId, billingPeriod, status, startedAt, expiresAt, note, paymentAmount, paymentNote } = parsed.data;

  const subscription = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId: user.id,
        planId,
        planCode: plan.code,
        billingPeriod: billingPeriod as BillingPeriod | undefined,
        status: status as SubscriptionStatus,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        gracePeriodEndsAt: expiresAt && plan.gracePeriodDays > 0
          ? new Date(new Date(expiresAt).getTime() + plan.gracePeriodDays * 86400000)
          : null,
        note,
      },
      include: { plan: true },
    });

    if (paymentAmount) {
      await tx.payment.create({
        data: {
          userId: user.id,
          subscriptionId: sub.id,
          amount: paymentAmount,
          status: PaymentStatus.success,
          note: paymentNote,
        },
      });
    }

    return sub;
  });

  res.status(201).json(subscription);
});

// Список подписок пользователя
adminRouter.get("/users/:userId/subscriptions", async (req, res) => {
  const subs = await prisma.subscription.findMany({
    where: { userId: req.params.userId },
    include: { plan: true, payments: true },
    orderBy: { startedAt: "desc" },
  });
  res.json(subs);
});

// Список всех подписок
adminRouter.get("/subscriptions", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const subs = await prisma.subscription.findMany({
    where: status ? { status: status as SubscriptionStatus } : undefined,
    include: {
      plan: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
  });
  res.json(subs);
});

// Обновить подписку (продлить, отменить, изменить статус)
const updateSubscriptionSchema = z.object({
  status: z.enum(["free", "trial", "active", "grace", "canceled", "expired"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  cancelReason: z.string().optional(),
  note: z.string().optional(),
});

adminRouter.patch("/subscriptions/:subId", async (req, res) => {
  const parsed = updateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { status, expiresAt, cancelReason, note } = parsed.data;
  const updateData: Prisma.SubscriptionUpdateInput = {};
  if (status) updateData.status = status as SubscriptionStatus;
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (cancelReason) { updateData.cancelReason = cancelReason; updateData.cancelledAt = new Date(); }
  if (note !== undefined) updateData.note = note;

  try {
    const sub = await prisma.subscription.update({
      where: { id: req.params.subId },
      data: updateData,
      include: { plan: true },
    });
    res.json(sub);
  } catch {
    res.status(404).json({ error: "Подписка не найдена" });
  }
});

// ── Платежи ────────────────────────────────────────────────────────────────

const createPaymentSchema = z.object({
  userId: z.string().min(1),
  subscriptionId: z.string().optional(),
  amount: z.number().positive(),
  status: z.enum(["success", "failed", "refunded"]).default("success"),
  note: z.string().optional(),
});

adminRouter.post("/payments", async (req, res) => {
  const parsed = createPaymentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const payment = await prisma.payment.create({
    data: {
      userId: parsed.data.userId,
      subscriptionId: parsed.data.subscriptionId,
      amount: parsed.data.amount,
      status: parsed.data.status as PaymentStatus,
      note: parsed.data.note,
    },
  });
  res.status(201).json(payment);
});
