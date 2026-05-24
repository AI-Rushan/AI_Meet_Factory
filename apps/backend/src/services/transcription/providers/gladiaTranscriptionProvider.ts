import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config";
import { getAudioChannels } from "../../fileDuration";
import { TranscriptionAdapter, TranscriptionResult } from "../types";

type GladiaUtterance = {
  speaker: number;
  start: number;
  end: number;
  text: string;
};

type GladiaResult = {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  result?: {
    transcription: {
      full_transcript: string;
      utterances?: GladiaUtterance[];
      languages?: string[];
    };
  };
  error_message?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Gladia — 10 часов/месяц бесплатно, поддерживает диаризацию спикеров
export class GladiaTranscriptionProvider implements TranscriptionAdapter {
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    if (!config.gladiaApiKey) throw new Error("GLADIA_API_KEY is not configured");

    const channels = await getAudioChannels(filePath);

    const buffer = await readFile(filePath);
    const uploadForm = new FormData();
    uploadForm.append("audio", new Blob([buffer]), path.basename(filePath));

    const uploadResp = await fetch("https://api.gladia.io/v2/upload", {
      method: "POST",
      headers: { "x-gladia-key": config.gladiaApiKey },
      body: uploadForm,
    });
    if (!uploadResp.ok) throw new Error(`Gladia upload failed: ${await uploadResp.text()}`);
    const { audio_url } = (await uploadResp.json()) as { audio_url: string };

    const transcribeResp = await fetch("https://api.gladia.io/v2/pre-recorded", {
      method: "POST",
      headers: {
        "x-gladia-key": config.gladiaApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url,
        diarization: true,
        diarization_config: {
          // Если каналов > 1 — используем это как точную подсказку о числе спикеров
          number_of_speakers: channels > 1 ? channels : 10,
        },
      }),
    });
    if (!transcribeResp.ok) throw new Error(`Gladia transcription submit failed: ${await transcribeResp.text()}`);
    const { id } = (await transcribeResp.json()) as { id: string };

    for (let attempt = 0; attempt < 240; attempt++) {
      await sleep(5000);
      const pollResp = await fetch(`https://api.gladia.io/v2/pre-recorded/${id}`, {
        headers: { "x-gladia-key": config.gladiaApiKey },
      });
      if (!pollResp.ok) throw new Error(`Gladia poll failed: ${await pollResp.text()}`);
      const data = (await pollResp.json()) as GladiaResult;

      if (data.status === "error") throw new Error(`Gladia error: ${data.error_message}`);
      if (data.status !== "done") continue;

      const transcription = data.result!.transcription;
      const utterances = transcription.utterances ?? [];
      const language = transcription.languages?.[0] ?? "unknown";

      const segments = utterances.map((u) => ({
        speakerKey: `SPEAKER_${u.speaker + 1}`,
        startSec: u.start,
        endSec: u.end,
        text: u.text.trim(),
      }));

      return {
        text: transcription.full_transcript,
        language,
        segments: segments.length > 0
          ? segments
          : [{ speakerKey: "SPEAKER_1", startSec: 0, endSec: 0, text: transcription.full_transcript }],
        provider: "gladia",
        model: "solaria-1",
        cost: 0,
      };
    }

    throw new Error("Gladia transcription timed out after 20 minutes");
  }
}
