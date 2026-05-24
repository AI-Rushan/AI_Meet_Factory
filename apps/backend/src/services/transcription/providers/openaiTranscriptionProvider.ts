import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config";
import { TranscriptionAdapter, TranscriptionResult } from "../types";

type WhisperVerboseResponse = {
  text: string;
  language: string;
  duration: number;
  segments: Array<{ start: number; end: number; text: string }>;
};

// OpenAI Whisper — $0.006/мин
// Whisper не поддерживает диаризацию и multichannel — все сегменты от SPEAKER_1.
// Стерео-файлы Whisper микширует в моно внутри автоматически.
export class OpenAITranscriptionProvider implements TranscriptionAdapter {
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

    const buffer = await readFile(filePath);
    const formData = new FormData();
    formData.append("file", new Blob([buffer]), path.basename(filePath));
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("language", "ru");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openaiApiKey}` },
      body: formData,
    });
    if (!response.ok) throw new Error(`OpenAI transcription failed: ${await response.text()}`);

    const data = (await response.json()) as WhisperVerboseResponse;
    const durationMin = (data.duration ?? 0) / 60;

    // Объединяем мелкие сегменты в более крупные (минимум 3 сек или конец предложения)
    const merged = mergeShortSegments(data.segments);

    return {
      text: data.text,
      language: data.language ?? "unknown",
      segments: merged.map((seg) => ({
        speakerKey: "SPEAKER_1",
        startSec: seg.start,
        endSec: seg.end,
        text: seg.text.trim(),
      })),
      provider: "openai",
      model: "whisper-1",
      cost: parseFloat((durationMin * 0.006).toFixed(4)),
    };
  }
}

function mergeShortSegments(
  segments: Array<{ start: number; end: number; text: string }>,
): Array<{ start: number; end: number; text: string }> {
  if (segments.length === 0) return [];
  const result: Array<{ start: number; end: number; text: string }> = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const duration = current.end - current.start;
    const endsWithPunct = /[.!?]$/.test(current.text.trim());

    if (duration < 3 && !endsWithPunct) {
      current.end = seg.end;
      current.text = current.text.trimEnd() + " " + seg.text.trimStart();
    } else {
      result.push(current);
      current = { ...seg };
    }
  }
  result.push(current);
  return result;
}
