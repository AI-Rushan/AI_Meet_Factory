import { readFile } from "node:fs/promises";
import { config } from "../../../config";
import { getAudioChannels } from "../../fileDuration";
import { TranscriptionAdapter, TranscriptionResult } from "../types";

type AssemblyUtterance = {
  speaker?: string;  // diarize mode: "A", "B", ...
  channel?: string;  // multichannel mode: "A", "B", ...
  start: number;
  end: number;
  text: string;
};

type AssemblyTranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text: string | null;
  utterances: AssemblyUtterance[] | null;
  audio_duration: number | null;
  speech_model_used: string | null;
  error: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ASSEMBLY_URL = "https://api.assemblyai.com/v2";

// AssemblyAI Universal-2 — асинхронная обработка (upload → poll)
// Цена: $0.0062/мин. Поддерживает multichannel и диаризацию.
export class AssemblyAITranscriptionProvider implements TranscriptionAdapter {
  private get headers() {
    return { Authorization: config.assemblyAiApiKey, "Content-Type": "application/json" };
  }

  async transcribe(filePath: string): Promise<TranscriptionResult> {
    if (!config.assemblyAiApiKey) throw new Error("ASSEMBLYAI_API_KEY is not configured");

    const channels = await getAudioChannels(filePath);
    const isMultichannel = channels > 1;

    const buffer = await readFile(filePath);
    const uploadResp = await fetch(`${ASSEMBLY_URL}/upload`, {
      method: "POST",
      headers: { Authorization: config.assemblyAiApiKey, "Content-Type": "application/octet-stream" },
      body: buffer,
    });
    if (!uploadResp.ok) throw new Error(`AssemblyAI upload failed: ${await uploadResp.text()}`);
    const { upload_url } = (await uploadResp.json()) as { upload_url: string };

    const submitBody = isMultichannel
      ? {
          audio_url: upload_url,
          speech_models: ["universal-3-pro", "universal-2"],
          multichannel: true,
          language_code: "ru",
          punctuate: true,
          format_text: true,
          entity_detection: true,
        }
      : {
          audio_url: upload_url,
          speech_models: ["universal-3-pro", "universal-2"],
          speaker_labels: true,
          language_code: "ru",
          punctuate: true,
          format_text: true,
          entity_detection: true,
        };

    const submitResp = await fetch(`${ASSEMBLY_URL}/transcript`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(submitBody),
    });
    if (!submitResp.ok) throw new Error(`AssemblyAI submit failed: ${await submitResp.text()}`);
    const { id } = (await submitResp.json()) as { id: string };

    for (let attempt = 0; attempt < 240; attempt++) {
      await sleep(5000);
      const pollResp = await fetch(`${ASSEMBLY_URL}/transcript/${id}`, { headers: this.headers });
      if (!pollResp.ok) throw new Error(`AssemblyAI poll failed: ${await pollResp.text()}`);
      const data = (await pollResp.json()) as AssemblyTranscript;

      if (data.status === "error") throw new Error(`AssemblyAI error: ${data.error}`);
      if (data.status !== "completed") continue;

      const utterances = data.utterances ?? [];
      const durationSec = data.audio_duration ?? 0;

      const segments = utterances.map((u) => {
        // В multichannel-режиме идентификатор — channel ("A","B",...), в diarize — speaker ("A","B",...)
        const label = u.channel ?? u.speaker ?? "A";
        const speakerNum = label.charCodeAt(0) - 64; // A→1, B→2, ...
        return {
          speakerKey: `SPEAKER_${speakerNum}`,
          startSec: u.start / 1000,
          endSec: u.end / 1000,
          text: u.text.trim(),
        };
      });

      return {
        text: data.text ?? "",
        language: "ru",
        segments: segments.length > 0
          ? segments
          : [{ speakerKey: "SPEAKER_1", startSec: 0, endSec: durationSec, text: data.text ?? "" }],
        provider: "assemblyai",
        model: data.speech_model_used ?? "universal-2",
        cost: parseFloat(((durationSec / 60) * 0.0062).toFixed(4)),
      };
    }

    throw new Error("AssemblyAI transcription timed out after 20 minutes");
  }
}
