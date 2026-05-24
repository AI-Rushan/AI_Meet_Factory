import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config";
import { getAudioChannels } from "../../fileDuration";
import { TranscriptionAdapter, TranscriptionResult } from "../types";

const MIME_MAP: Record<string, string> = {
  ".mp3":  "audio/mpeg",
  ".mp4":  "audio/mp4",
  ".m4a":  "audio/mp4",
  ".wav":  "audio/wav",
  ".ogg":  "audio/ogg",
  ".webm": "audio/webm",
  ".flac": "audio/flac",
  ".aac":  "audio/aac",
  ".opus": "audio/opus",
};

type DeepgramWord = {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
};

type DeepgramUtterance = {
  speaker: number;
  start: number;
  end: number;
  transcript: string;
};

type DeepgramResponse = {
  metadata: { duration: number };
  results: {
    utterances?: DeepgramUtterance[];
    channels: Array<{
      alternatives: Array<{ transcript: string; words?: DeepgramWord[] }>;
    }>;
  };
};

// Deepgram Nova-3 — синхронный ответ, диаризация или multichannel
// Цена: $0.0077/час
export class DeepgramTranscriptionProvider implements TranscriptionAdapter {
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    if (!config.deepgramApiKey) throw new Error("DEEPGRAM_API_KEY is not configured");

    const channels = await getAudioChannels(filePath);
    const isMultichannel = channels > 1;

    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext] ?? "audio/mpeg";

    const params = new URLSearchParams({
      model: "nova-3",
      smart_format: "true",
      language: "ru",
      punctuate: "true",
      ...(isMultichannel
        ? { multichannel: "true" }
        : { diarize: "true", utterances: "true", utt_split: "1.5" }
      ),
    });

    const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${config.deepgramApiKey}`,
        "Content-Type": mimeType,
      },
      body: buffer,
    });
    if (!response.ok) throw new Error(`Deepgram transcription failed: ${await response.text()}`);

    const data = (await response.json()) as DeepgramResponse;
    const duration = data.metadata?.duration ?? 0;
    const fullText = data.results.channels[0]?.alternatives[0]?.transcript ?? "";

    const segments = isMultichannel
      ? this.segmentsFromChannels(data.results.channels)
      : this.segmentsFromUtterances(data.results.utterances ?? [], duration, fullText);

    return {
      text: segments.map((s) => s.text).join(" ") || fullText,
      language: "ru",
      segments,
      provider: "deepgram",
      model: "nova-3",
      cost: parseFloat(((duration / 3600) * 0.0077).toFixed(5)),
    };
  }

  // Режим multichannel: каждый канал = отдельный спикер
  private segmentsFromChannels(
    channels: DeepgramResponse["results"]["channels"],
  ): TranscriptionResult["segments"] {
    // Собираем все слова из всех каналов с меткой канала
    const allWords: Array<{ start: number; end: number; text: string; channel: number }> = [];
    channels.forEach((ch, idx) => {
      for (const w of ch.alternatives[0]?.words ?? []) {
        allWords.push({
          start: w.start,
          end: w.end,
          text: w.punctuated_word ?? w.word,
          channel: idx,
        });
      }
    });

    if (allWords.length === 0) return [];

    allWords.sort((a, b) => a.start - b.start);

    // Группируем последовательные слова одного канала в сегменты
    const segments: TranscriptionResult["segments"] = [];
    let group = [allWords[0]];

    for (let i = 1; i < allWords.length; i++) {
      const w = allWords[i];
      const prev = group[group.length - 1];
      if (w.channel === group[0].channel && w.start - prev.end < 1.5) {
        group.push(w);
      } else {
        segments.push({
          speakerKey: `SPEAKER_${group[0].channel + 1}`,
          startSec: group[0].start,
          endSec: prev.end,
          text: group.map((x) => x.text).join(" "),
        });
        group = [w];
      }
    }
    const last = group[group.length - 1];
    segments.push({
      speakerKey: `SPEAKER_${group[0].channel + 1}`,
      startSec: group[0].start,
      endSec: last.end,
      text: group.map((x) => x.text).join(" "),
    });

    return segments;
  }

  // Режим diarize: стандартные utterances
  private segmentsFromUtterances(
    utterances: DeepgramUtterance[],
    duration: number,
    fullText: string,
  ): TranscriptionResult["segments"] {
    if (utterances.length > 0) {
      return utterances.map((u) => ({
        speakerKey: `SPEAKER_${u.speaker + 1}`,
        startSec: u.start,
        endSec: u.end,
        text: u.transcript.trim(),
      }));
    }
    return [{ speakerKey: "SPEAKER_1", startSec: 0, endSec: duration, text: fullText }];
  }
}
