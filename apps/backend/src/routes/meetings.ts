import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { prisma } from "../db";
import { config } from "../config";
import { getMediaDurationSec } from "../services/fileDuration";
import { processingQueue } from "../queue";
import { getPostProcessingProvider } from "../services/postprocessing/factory";
import { exportToEmail, exportToTelegram, renderTranscriptText } from "../services/exportService";
import { createMeetingSchema, updateMeetingSchema } from "../dto/meetings";
import { meetingsService } from "../services/meetingsService";

const askQuestionSchema = z.object({
  question: z.string().min(3),
});

const updateSpeakerSchema = z.object({
  confirmed_name: z.string().min(1).nullable().optional(),
  confirmedName: z.string().min(1).nullable().optional(),
  finalName: z.string().min(1).nullable().optional(),
}).refine((payload) => payload.confirmed_name !== undefined || payload.confirmedName !== undefined || payload.finalName !== undefined, {
  message: "confirmedName is required",
});

const updateTaskSchema = z.object({
  text_final: z.string().min(1).optional(),
  assignee_final: z.string().min(1).optional(),
  due_date_final: z.string().min(1).optional(),
  finalText: z.string().min(1).optional(),
  finalAssignee: z.string().min(1).optional(),
  finalDueDate: z.string().min(1).optional(),
  done: z.boolean().optional(),
}).refine((payload) =>
  payload.text_final !== undefined ||
  payload.assignee_final !== undefined ||
  payload.due_date_final !== undefined ||
  payload.finalText !== undefined ||
  payload.finalAssignee !== undefined ||
  payload.finalDueDate !== undefined ||
  payload.done !== undefined,
{ message: "At least one task field is required" });

const exportSchema = z.object({
  target: z.enum(["EMAIL", "TELEGRAM"]),
  destination: z.string().optional(),
  chatIds: z.array(z.string()).optional(),
}).refine((d) => d.target === "TELEGRAM" ? (d.chatIds && d.chatIds.length > 0) : !!d.destination, {
  message: "destination is required for EMAIL; chatIds is required for TELEGRAM",
});

const allowedMimeTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/x-mp3",
  "audio/mpeg3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "video/mp4",
  "video/quicktime",
  "audio/webm",
  "video/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/aac",
  "video/x-matroska",
  "video/x-msvideo",
  "video/avi",
  "video/x-ms-wmv",
  "video/3gpp",
  "video/x-flv",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 700 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error(`Unsupported mime type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

const getOwnedMeeting = async (meetingId: string, userId: string, workspaceId: string) =>
  prisma.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId,
      workspace: { memberships: { some: { userId } } },
    },
  });

export const meetingsRouter = Router();

meetingsRouter.use(authRequired);

meetingsRouter.get("/", async (req, res) => {
  try {
    const { search, status, sortBy, order } = req.query as Record<string, string | undefined>;
    const VALID_STATUSES = ["CREATED", "PROCESSING", "READY", "FAILED"] as const;
    type ValidStatus = (typeof VALID_STATUSES)[number];
    const meetings = await meetingsService.listMyMeetings(req.auth!, {
      search: search || undefined,
      status: VALID_STATUSES.includes(status as ValidStatus) ? (status as ValidStatus) : undefined,
      sortBy: sortBy === "title" ? "title" : "createdAt",
      order: order === "asc" ? "asc" : "desc",
    });
    res.json(meetings);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_WORKSPACE_MEMBERSHIP") {
      res.status(403).json({ error: "No workspace membership" });
      return;
    }

    res.status(500).json({ error: "Failed to list meetings" });
  }
});

meetingsRouter.post("/", async (req, res) => {
  const payload = createMeetingSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  try {
    const meeting = await meetingsService.createMeeting(req.auth!, payload.data);
    res.status(201).json(meeting);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_WORKSPACE_MEMBERSHIP") {
      res.status(403).json({ error: "No workspace membership" });
      return;
    }

    res.status(500).json({ error: "Failed to create meeting" });
  }
});

meetingsRouter.post("/:meetingId/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message ?? "Ошибка загрузки файла" });
      return;
    }
    next();
  });
}, async (req, res) => {
  const auth = req.auth!;
  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }

  let durationSec: number;
  try {
    durationSec = await getMediaDurationSec(req.file.path);
  } catch (error) {
    await fs.rm(req.file.path, { force: true });
    const message = error instanceof Error ? error.message : "Cannot read media duration";
    res.status(400).json({ error: `Duration validation failed: ${message}` });
    return;
  }

  if (durationSec > config.maxMeetingMinutes * 60) {
    await fs.rm(req.file.path, { force: true });
    res.status(400).json({
      error: `Duration exceeds ${config.maxMeetingMinutes} minutes`,
      maxMinutes: config.maxMeetingMinutes,
      actualMinutes: Number((durationSec / 60).toFixed(2)),
    });
    return;
  }

  const sourceTempPath = path.resolve(req.file.path);
  const previousSourceTempPath = meeting.sourceTempPath;
  const now = new Date();
  const transcriptionConfig = await prisma.aIModelConfig.findFirst({
    where: { purpose: "transcription", isActive: true },
  });

  const run = await prisma.$transaction(async (tx) => {
    const createdRun = await tx.meetingProcessingRun.create({
      data: {
        meetingId: meeting.id,
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        status: "pending",
      },
    });

    await tx.processingStepLog.create({
      data: {
        runId: createdRun.id,
        userId: auth.userId,
        stepName: "file_received",
        status: "success",
        provider: transcriptionConfig?.provider,
        model: transcriptionConfig?.model,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
      },
    });

    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        sourceFilename: req.file.originalname,
        sourceMimeType: req.file.mimetype,
        sourceDurationSec: Math.round(durationSec),
        sourceTempPath,
        status: "PROCESSING",
        processingError: null,
      },
    });

    return createdRun;
  });

  if (previousSourceTempPath && previousSourceTempPath !== sourceTempPath) {
    await fs.rm(previousSourceTempPath, { force: true });
  }

  try {
    await processingQueue.add(
      "process-meeting",
      { meetingId: meeting.id, runId: run.id },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue processing";

    await prisma.meetingProcessingRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorCode: "QUEUE_ENQUEUE_FAILED",
        errorMessage: message,
        finishedAt: new Date(),
      },
    });

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "FAILED",
        processingError: message,
      },
    });

    await fs.rm(sourceTempPath, { force: true });
    res.status(500).json({ error: "Failed to start processing" });
    return;
  }

  res.status(202).json({ runId: run.id, status: "pending" });
});

meetingsRouter.get("/:meetingId", async (req, res) => {
  const meeting = await meetingsService.getMeetingById(req.auth!, req.params.meetingId);

  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  res.json({
    ...meeting,
    processing: {
      status: meeting.status,
      error: meeting.processingError,
      latestRun: meeting.runs[0] ?? null,
    },
  });
});

meetingsRouter.patch("/:meetingId", async (req, res) => {
  const payload = updateMeetingSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  try {
    const meeting = await meetingsService.updateMeeting(req.auth!, req.params.meetingId, payload.data);
    res.json(meeting);
  } catch (error) {
    if (error instanceof Error && error.message === "MEETING_NOT_FOUND") {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Invalid meeting status transition")) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Failed to update meeting" });
  }
});

meetingsRouter.get("/:meetingId/transcript.txt", async (req, res) => {
  const auth = req.auth!;
  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const text = await renderTranscriptText(meeting.id);
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="meeting-${meeting.id}.txt"`);
  res.send(text);
});

meetingsRouter.patch("/:meetingId/transcript", async (req, res) => {
  const auth = req.auth!;
  const schema = z.object({
    segments: z.array(z.object({
      id: z.string(),
      text: z.string(),
      speakerId: z.string().nullable().optional(),
    })).optional(),
    rawText: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const transcript = await prisma.transcript.findUnique({ where: { meetingId: meeting.id } });
  if (!transcript) {
    res.status(404).json({ error: "Transcript not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.segments) {
      for (const seg of parsed.data.segments) {
        const data: { text: string; speakerId?: string | null } = { text: seg.text };
        if (seg.speakerId !== undefined) data.speakerId = seg.speakerId;
        await tx.transcriptSegment.updateMany({
          where: { id: seg.id, transcriptId: transcript.id },
          data,
        });
      }
    }

    const newRawText = parsed.data.rawText ??
      (parsed.data.segments
        ? (await tx.transcriptSegment.findMany({
            where: { transcriptId: transcript.id },
            orderBy: { segmentOrder: "asc" },
          })).map((s) => s.text).join(" ")
        : undefined);

    if (newRawText !== undefined) {
      await tx.transcript.update({
        where: { id: transcript.id },
        data: { rawText: newRawText },
      });
    }
  });

  res.json({ ok: true });
});

meetingsRouter.post("/:meetingId/speakers", async (req, res) => {
  const auth = req.auth!;
  const schema = z.object({
    autoLabel: z.string().min(1).max(60),
    confirmedName: z.string().min(1).max(120).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const speaker = await prisma.speaker.create({
    data: {
      meetingId: meeting.id,
      speakerKey: `SPEAKER_MANUAL_${Date.now()}`,
      autoLabel: parsed.data.autoLabel,
      confirmedName: parsed.data.confirmedName ?? null,
    },
  });

  res.status(201).json(speaker);
});

meetingsRouter.patch("/:meetingId/speakers/:speakerId", async (req, res) => {
  const auth = req.auth!;
  const payload = updateSpeakerSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const updated = await prisma.speaker.updateMany({
    where: { id: req.params.speakerId, meetingId: meeting.id },
    data: { confirmedName: payload.data.confirmed_name ?? payload.data.confirmedName ?? payload.data.finalName ?? null },
  });
  if (!updated.count) {
    res.status(404).json({ error: "Speaker not found" });
    return;
  }
  const speaker = await prisma.speaker.findUniqueOrThrow({ where: { id: req.params.speakerId } });
  res.json(speaker);
});

meetingsRouter.post("/:meetingId/tasks", async (req, res) => {
  const auth = req.auth!;
  const schema = z.object({
    text: z.string().min(1),
    assignee: z.string().optional(),
    dueDate: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const lastTask = await prisma.taskItem.findFirst({
    where: { meetingId: meeting.id },
    orderBy: { taskOrder: "desc" },
    select: { taskOrder: true },
  });

  const task = await prisma.taskItem.create({
    data: {
      meetingId: meeting.id,
      autoText: parsed.data.text,
      finalText: parsed.data.text,
      autoAssignee: parsed.data.assignee ?? "",
      finalAssignee: parsed.data.assignee ?? "",
      autoDueDate: parsed.data.dueDate ?? "",
      finalDueDate: parsed.data.dueDate ?? "",
      taskOrder: (lastTask?.taskOrder ?? -1) + 1,
    },
  });

  res.status(201).json(task);
});

meetingsRouter.delete("/:meetingId/tasks/:taskId", async (req, res) => {
  const auth = req.auth!;
  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const deleted = await prisma.taskItem.deleteMany({
    where: { id: req.params.taskId, meetingId: meeting.id },
  });
  if (!deleted.count) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.status(204).send();
});

meetingsRouter.patch("/:meetingId/tasks/:taskId", async (req, res) => {
  const auth = req.auth!;
  const payload = updateTaskSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const updated = await prisma.taskItem.updateMany({
    where: { id: req.params.taskId, meetingId: meeting.id },
    data: {
      finalText: payload.data.text_final ?? payload.data.finalText,
      finalAssignee: payload.data.assignee_final ?? payload.data.finalAssignee,
      finalDueDate: payload.data.due_date_final ?? payload.data.finalDueDate,
      done: payload.data.done,
    },
  });
  if (!updated.count) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const task = await prisma.taskItem.findUniqueOrThrow({ where: { id: req.params.taskId } });

  res.json(task);
});

meetingsRouter.post("/:meetingId/questions", async (req, res) => {
  const auth = req.auth!;
  const payload = askQuestionSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const transcript = await prisma.transcript.findUnique({ where: { meetingId: meeting.id } });
  if (!transcript) {
    res.status(400).json({ error: "Transcript is not ready" });
    return;
  }

  const postConfig = await prisma.aIModelConfig.findFirst({ where: { purpose: "postprocessing", isActive: true } });
  const postProvider = getPostProcessingProvider(postConfig?.provider);
  const response = await postProvider.answerQuestion(transcript.rawText, payload.data.question);

  const saved = await prisma.meetingQuestion.create({
    data: {
      meetingId: meeting.id,
      userId: auth.userId,
      question: payload.data.question,
      answer: response.answer,
    },
  });

  res.status(201).json(saved);
});

meetingsRouter.post("/:meetingId/export", async (req, res) => {
  const auth = req.auth!;
  const payload = exportSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const destination = payload.data.destination ?? payload.data.chatIds?.join(",") ?? "";

  try {
    if (payload.data.target === "EMAIL") {
      await exportToEmail(meeting.id, payload.data.destination!);
    } else {
      await exportToTelegram(meeting.id, payload.data.chatIds!);
    }

    const log = await prisma.exportLog.create({
      data: {
        meetingId: meeting.id,
        userId: auth.userId,
        target: payload.data.target,
        destination,
        status: "success",
      },
    });
    res.status(201).json(log);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    const log = await prisma.exportLog.create({
      data: {
        meetingId: meeting.id,
        userId: auth.userId,
        target: payload.data.target,
        destination,
        status: "failed",
        errorMessage: message,
      },
    });
    res.status(500).json({ error: message, logId: log.id });
  }
});

meetingsRouter.post("/:meetingId/summary", async (req, res) => {
  const auth = req.auth!;

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const transcript = await prisma.transcript.findUnique({ where: { meetingId: meeting.id } });
  if (!transcript) {
    res.status(400).json({ error: "Транскрипция ещё не готова" });
    return;
  }

  const postConfig = await prisma.aIModelConfig.findFirst({
    where: { purpose: "postprocessing", isActive: true },
  });
  const postProvider = getPostProcessingProvider(postConfig?.provider);

  const result = await postProvider.summarize(transcript.rawText);
  const summaryJson = JSON.stringify(result.summary);

  const summary = await prisma.summary.upsert({
    where: { meetingId: meeting.id },
    update: { text: summaryJson, version: { increment: 1 } },
    create: { meetingId: meeting.id, text: summaryJson, version: 1 },
  });

  res.json({ ...summary, parsed: result.summary });
});


meetingsRouter.post("/:meetingId/tasks/extract", async (req, res) => {
  const auth = req.auth!;

  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const transcript = await prisma.transcript.findUnique({ where: { meetingId: meeting.id } });
  if (!transcript) {
    res.status(400).json({ error: "Транскрипция ещё не готова" });
    return;
  }

  const postConfig = await prisma.aIModelConfig.findFirst({
    where: { purpose: "postprocessing", isActive: true },
  });
  const postProvider = getPostProcessingProvider(postConfig?.provider);

  const tasksResponse = await postProvider.extractTasks(transcript.rawText);

  await prisma.$transaction(async (tx) => {
    await tx.taskItem.deleteMany({ where: { meetingId: meeting.id } });
    if (tasksResponse.tasks.length > 0) {
      await tx.taskItem.createMany({
        data: tasksResponse.tasks.map((task, index) => ({
          meetingId: meeting.id,
          autoText: task.text,
          finalText: task.text,
          autoAssignee: task.assignee ?? "ответственный не определен",
          finalAssignee: task.assignee ?? "ответственный не определен",
          autoDueDate: task.dueDate ?? "срок не установлен",
          finalDueDate: task.dueDate ?? "срок не установлен",
          taskOrder: index,
        })),
      });
    }
  });

  const tasks = await prisma.taskItem.findMany({
    where: { meetingId: meeting.id },
    orderBy: { taskOrder: "asc" },
  });

  res.json(tasks);
});

meetingsRouter.get("/telegram/contacts", async (_req, res) => {
  const contacts = await prisma.telegramContact.findMany({
    orderBy: { name: "asc" },
  });
  res.json(contacts);
});

meetingsRouter.post("/telegram/contacts/refresh", async (_req, res) => {
  if (!config.telegramBotToken) {
    res.status(400).json({ error: "TELEGRAM_BOT_TOKEN не настроен" });
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?limit=100`,
  );
  const data = (await response.json()) as {
    ok: boolean;
    result?: Array<{
      message?: {
        chat: { id: number; first_name?: string; last_name?: string; username?: string; title?: string; type: string };
      };
    }>;
  };
  if (!data.ok) {
    res.status(502).json({ error: "Telegram API error" });
    return;
  }

  const seen = new Map<number, { chatId: string; name: string; username?: string; type: string }>();
  for (const update of data.result ?? []) {
    const chat = update.message?.chat;
    if (!chat || seen.has(chat.id)) continue;
    const firstName = chat.first_name ?? "";
    const lastName = chat.last_name ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    seen.set(chat.id, {
      chatId: String(chat.id),
      name: chat.title ?? (fullName || chat.username) ?? String(chat.id),
      username: chat.username,
      type: chat.type,
    });
  }

  await Promise.all(
    Array.from(seen.values()).map((c) =>
      prisma.telegramContact.upsert({
        where: { chatId: c.chatId },
        update: { name: c.name, username: c.username, type: c.type },
        create: { chatId: c.chatId, name: c.name, username: c.username, type: c.type },
      }),
    ),
  );

  const contacts = await prisma.telegramContact.findMany({ orderBy: { name: "asc" } });
  res.json(contacts);
});

meetingsRouter.delete("/:meetingId", async (req, res) => {
  const auth = req.auth!;
  const meeting = await getOwnedMeeting(req.params.meetingId, auth.userId, auth.workspaceId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  if (meeting.sourceTempPath) {
    await fs.rm(meeting.sourceTempPath, { force: true }).catch(() => undefined);
  }

  await prisma.meeting.delete({ where: { id: meeting.id } });
  res.status(204).send();
});
