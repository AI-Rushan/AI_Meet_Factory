import { Router } from "express";
import { Prisma, WorkspaceKind, MembershipRole } from "@prisma/client";
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

  const { email, name, isAdmin, password } = parsed.data;

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
  if (password) updateData.passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: updateData,
      select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: "Пользователь не найден" });
  }
});

// Удалить пользователя
adminRouter.delete("/users/:userId", async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.membership.deleteMany({ where: { userId: req.params.userId } });
      await tx.user.delete({ where: { id: req.params.userId } });
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Пользователь не найден или не может быть удалён" });
  }
});
