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

// Ollama STT через OpenAI-совместимый audio endpoint
// Поддерживается в сборках Ollama с whisper-моделями и в LocalAI с Ollama-совместимым API
// URL берётся из OLLAMA_BASE_URL (по умолчанию http://localhost:11434)
// Модели для транскрипции в Ollama: whisper (через LocalAI), или используй faster-whisper-server
//
// Быстрый запуск LocalAI с Whisper:
//   docker run -p 8080:8080 localai/localai:latest whisper-base
// Или нативный Ollama (если поддерживает audio):
//   ollama pull whisper
export class OllamaTranscriptionProvider implements TranscriptionAdapter {
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    const baseUrl = config.ollamaBaseUrl.replace(/\/$/, "");

    const buffer = await readFile(filePath);
    const formData = new FormData();
    formData.append("file", new Blob([buffer]), path.basename(filePath));
    formData.append("model", "whisper");
    formData.append("response_format", "verbose_json");

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama transcription at ${baseUrl} failed: ${await response.text()}. ` +
        `Убедитесь что Ollama запущена и поддерживает STT (или используйте LocalAI).`,
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
      provider: "ollama",
      model: "whisper",
      cost: 0,
    };
  }
}
