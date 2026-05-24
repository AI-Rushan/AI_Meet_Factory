import fs from "node:fs/promises";
import { prisma } from "./db";
import { config } from "./config";

const ensureActiveModelConfig = async (
  purpose: "transcription" | "postprocessing",
  defaultProvider: string,
  defaultModel: string,
): Promise<void> => {
  const active = await prisma.aIModelConfig.findFirst({
    where: { purpose, isActive: true },
  });
  if (!active) {
    await prisma.aIModelConfig.create({
      data: { purpose, provider: defaultProvider, model: defaultModel, isActive: true },
    });
  }
};

export const bootstrap = async (): Promise<void> => {
  await fs.mkdir(config.uploadDir, { recursive: true });

  await ensureActiveModelConfig(
    "transcription",
    config.transcriptionProvider,
    config.transcriptionProvider === "openai" ? "whisper-1" : "mock-transcribe-v1",
  );

  await ensureActiveModelConfig(
    "postprocessing",
    config.postprocessingProvider,
    config.postprocessingProvider === "openai" ? "gpt-4o-mini" : "mock-post-v1",
  );
};
