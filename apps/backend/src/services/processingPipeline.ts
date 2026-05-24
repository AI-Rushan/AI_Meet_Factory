import { MeetingStatus } from "@prisma/client";
import { ProcessingStepName } from "@meeting-ai/shared";
import fs from "node:fs/promises";
import { prisma } from "../db";
import { getTranscriptionProvider } from "./transcription/factory";
import { getPostProcessingProvider } from "./postprocessing/factory";

type RunStepContext = {
  runId: string;
  userId: string;
};

const createStep = async (
  context: RunStepContext,
  stepName: ProcessingStepName,
  status: "started" | "success" | "failed",
  params?: {
    provider?: string;
    model?: string;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
    cost?: number;
    errorCode?: string;
    errorMessage?: string;
  },
) =>
  prisma.processingStepLog.create({
    data: {
      runId: context.runId,
      userId: context.userId,
      stepName,
      status,
      provider: params?.provider,
      model: params?.model,
      startedAt: params?.startedAt,
      finishedAt: params?.finishedAt,
      durationMs: params?.durationMs,
      cost: params?.cost ?? 0,
      errorCode: params?.errorCode,
      errorMessage: params?.errorMessage,
    },
  });

const runStep = async <T>(
  context: RunStepContext,
  stepName: ProcessingStepName,
  action: () => Promise<{ result: T; cost?: number }>,
  meta?: { provider?: string; model?: string },
): Promise<T> => {
  const startedAt = new Date();
  await createStep(context, stepName, "started", {
    startedAt,
    provider: meta?.provider,
    model: meta?.model,
  });
  try {
    const { result, cost = 0 } = await action();
    const finishedAt = new Date();
    await createStep(context, stepName, "success", {
      provider: meta?.provider,
      model: meta?.model,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      cost,
    });
    await prisma.meetingProcessingRun.update({
      where: { id: context.runId },
      data: { totalCost: { increment: cost } },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown step error";
    const finishedAt = new Date();
    await createStep(context, stepName, "failed", {
      provider: meta?.provider,
      model: meta?.model,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      errorCode: "STEP_FAILED",
      errorMessage: message,
    });
    throw error;
  }
};

export const processMeetingRun = async (meetingId: string, runId: string): Promise<void> => {
  const run = await prisma.meetingProcessingRun.findUnique({
    where: { id: runId },
    include: { meeting: true },
  });
  if (!run) {
    return;
  }

  // Always resolve active configs at the moment of run start — фиксируем фактически использованные модели
  const transcriptionConfig = await prisma.aIModelConfig.findFirst({
    where: { purpose: "transcription", isActive: true },
  });
  const postConfig = await prisma.aIModelConfig.findFirst({
    where: { purpose: "postprocessing", isActive: true },
  });

  const context: RunStepContext = {
    runId,
    userId: run.userId,
  };

  const runStartedAt = new Date();
  await prisma.meetingProcessingRun.update({
    where: { id: runId },
    data: {
      status: "running",
      startedAt: runStartedAt,
      // Фиксируем фактически использованные провайдер/модель на момент запуска
      transcriptionProvider: transcriptionConfig?.provider ?? null,
      transcriptionModel: transcriptionConfig?.model ?? null,
      postprocessingProvider: postConfig?.provider ?? null,
      postprocessingModel: postConfig?.model ?? null,
    },
  });
  await prisma.meeting.update({ where: { id: meetingId }, data: { status: MeetingStatus.PROCESSING } });

  // Отслеживаем успешные и неуспешные шаги для статуса partial_failed
  let hasSuccessfulSteps = false;
  let hasFailedSteps = false;

  try {
    const fileReceivedExists = await prisma.processingStepLog.findFirst({
      where: { runId, stepName: "file_received" },
      select: { id: true },
    });
    if (!fileReceivedExists) {
      await runStep(context, "file_received", async () => ({ result: true }), {
        provider: transcriptionConfig?.provider,
        model: transcriptionConfig?.model,
      });
    }
    hasSuccessfulSteps = true;

    const transcriptionProvider = getTranscriptionProvider(transcriptionConfig?.provider);
    const transcriptOutput = await runStep(context, "transcription_requested", async () => {
      if (run.meeting.sourceTempPath) {
        const result = await transcriptionProvider.transcribe(run.meeting.sourceTempPath);
        return { result, cost: result.cost };
      }

      const existingTranscript = await prisma.transcript.findUnique({
        where: { meetingId },
        include: {
          segments: {
            orderBy: { segmentOrder: "asc" },
            include: { speaker: true },
          },
        },
      });
      if (!existingTranscript) {
        throw new Error("No source file path or existing transcript for rerun");
      }

      return {
        result: {
          text: existingTranscript.rawText,
          language: existingTranscript.language ?? "unknown",
          segments: existingTranscript.segments.map((segment) => ({
            speakerKey: segment.speaker?.speakerKey ?? "SPEAKER_UNKNOWN",
            startSec: segment.startSec,
            endSec: segment.endSec,
            text: segment.text,
          })),
          provider: transcriptionConfig?.provider ?? "reuse-existing-transcript",
          model: transcriptionConfig?.model ?? "reuse-existing-transcript",
          cost: 0,
        },
        cost: 0,
      };
    }, { provider: transcriptionConfig?.provider, model: transcriptionConfig?.model });

    const speakerKeySet = new Set(transcriptOutput.segments.map((segment) => segment.speakerKey));
    const speakerKeys = Array.from(speakerKeySet);

    await runStep(context, "transcription_completed", async () => {
      if (!run.meeting.sourceTempPath) {
        return { result: true };
      }

      await prisma.$transaction(async (tx) => {
        await tx.transcript.deleteMany({ where: { meetingId } });
        const transcript = await tx.transcript.create({
          data: {
            meetingId,
            rawText: transcriptOutput.text,
            language: transcriptOutput.language,
          },
        });

        const speakers = await Promise.all(
          speakerKeys.map((speakerKey, index) =>
            tx.speaker.upsert({
              where: {
                meetingId_speakerKey: { meetingId, speakerKey },
              },
              update: {},
              create: {
                meetingId,
                speakerKey,
                autoLabel: `Спикер ${index + 1}`,
              },
            }),
          ),
        );

        const speakerByKey = new Map(speakers.map((speaker) => [speaker.speakerKey, speaker.id]));

        if (transcriptOutput.segments.length > 0) {
          await tx.transcriptSegment.createMany({
            data: transcriptOutput.segments.map((segment, index) => ({
              transcriptId: transcript.id,
              speakerId: speakerByKey.get(segment.speakerKey) ?? null,
              startSec: segment.startSec,
              endSec: segment.endSec,
              text: segment.text,
              segmentOrder: index,
            })),
          });
        }
      });

      return { result: true };
    }, { provider: transcriptionConfig?.provider, model: transcriptionConfig?.model });

    await runStep(context, "source_deleted", async () => {
      if (run.meeting.sourceTempPath) {
        await fs.rm(run.meeting.sourceTempPath, { force: true });
      }
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { sourceTempPath: null },
      });
      return { result: true };
    }, { provider: transcriptionConfig?.provider, model: transcriptionConfig?.model });

    const postProvider = getPostProcessingProvider(postConfig?.provider);
    const transcript = await prisma.transcript.findUniqueOrThrow({
      where: { meetingId },
      include: { segments: { orderBy: { segmentOrder: "asc" } } },
    });

    const speakers = await prisma.speaker.findMany({ where: { meetingId }, orderBy: { autoLabel: "asc" } });

    await runStep(context, "speakers_identified", async () => {
      const speakerLabels = speakers.map((speaker) => speaker.autoLabel);
      const response = await postProvider.suggestSpeakerNames(transcript.rawText, speakerLabels);

      await prisma.$transaction(
        speakers.map((speaker) =>
          prisma.speaker.update({
            where: { id: speaker.id },
            data: { suggestedName: response.suggestions[speaker.autoLabel] ?? null },
          }),
        ),
      );
      return { result: true, cost: response.cost };
    }, { provider: postConfig?.provider, model: postConfig?.model });

    await runStep(context, "meeting_qa_prepared", async () => ({ result: true }), {
      provider: postConfig?.provider,
      model: postConfig?.model,
    });
    await runStep(context, "results_saved", async () => ({ result: true }), {
      provider: postConfig?.provider,
      model: postConfig?.model,
    });
    await runStep(context, "processing_completed", async () => ({ result: true }), {
      provider: postConfig?.provider,
      model: postConfig?.model,
    });

    const finishedAt = new Date();
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: MeetingStatus.READY } });
    await prisma.meetingProcessingRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        finishedAt,
        durationMs: finishedAt.getTime() - runStartedAt.getTime(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    const finishedAt = new Date();

    if (run.meeting.sourceTempPath) {
      await fs.rm(run.meeting.sourceTempPath, { force: true }).catch(() => undefined);
    }

    // Определяем итоговый статус: partial_failed если часть шагов уже прошла успешно
    const completedSteps = await prisma.processingStepLog.count({
      where: { runId, status: "success" },
    });
    const finalRunStatus = completedSteps > 0 ? "partial_failed" : "failed";

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.FAILED, processingError: message, sourceTempPath: null },
    });

    await prisma.meetingProcessingRun.update({
      where: { id: runId },
      data: {
        status: finalRunStatus,
        errorCode: "RUN_FAILED",
        errorMessage: message,
        finishedAt,
        durationMs: finishedAt.getTime() - runStartedAt.getTime(),
      },
    });

    throw error;
  }
};
