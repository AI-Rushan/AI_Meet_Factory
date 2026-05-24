import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config";
import { TranscriptionAdapter, TranscriptionResult } from "../types";

type WhisperVerboseResponse = {
  text: string;
  language: string;
  duration?: number;
  segments: Array<{ start: number; end: number; text: string }>;
};

// Локальный Whisper через OpenAI-совместимый HTTP-сервер
// Совместимо с: faster-whisper-server, whisper.cpp --server, LocalAI
// Запуск faster-whisper-server: docker run -p 8080:8080 fedirz/faster-whisper-server:latest
export class WhisperLocalProvider implements TranscriptionAdapter {
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    const baseUrl = config.whisperLocalUrl.replace(/\/$/, "");

    const buffer = await readFile(filePath);
    const formData = new FormData();
    formData.append("file", new Blob([buffer]), path.basename(filePath));
    formData.append("model", "large-v3");
    formData.append("response_format", "verbose_json");

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(
        `Whisper local server at ${baseUrl} failed: ${await response.text()}. ` +
        `Убедитесь что WHISPER_LOCAL_URL указан верно и сервер запущен.`,
      );
    }

    const data = (await response.json()) as WhisperVerboseResponse;

    return {
      text: data.text,
      language: data.language ?? "unknown",
      segments: (data.segments ?? []).map((seg) => ({
        speakerKey: "SPEAKER_1",
        startSec: seg.start,
        endSec: seg.end,
        text: seg.text.trim(),
      })),
      provider: "whisper-local",
      model: "large-v3",
      cost: 0,
    };
  }
}
