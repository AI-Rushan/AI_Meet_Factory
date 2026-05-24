import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config";
import { getAudioChannels } from "../../fileDuration";
import { TranscriptionAdapter, TranscriptionResult } from "../types";

const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL = "gemini-2.0-flash";

// Gemini 2.0 Flash pricing
const INPUT_COST_PER_TOKEN = 0.10 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.40 / 1_000_000;

type GeminiSegment = {
  speaker: string;
  startSec: number;
  endSec: number;
  text: string;
};

type GeminiOutput = {
  language: string;
  segments: GeminiSegment[];
};

type FileUploadResponse = {
  file: { uri: string; mimeType: string };
};

type GenerateResponse = {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
  };
};

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

async function uploadFile(buffer: Buffer, fileName: string, mimeType: string, apiKey: string): Promise<string> {
  // Step 1 — start resumable upload
  const startRes = await fetch(
    `${API_BASE}/upload/v1beta/files?uploadType=resumable&key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(buffer.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: fileName } }),
    },
  );

  if (!startRes.ok) {
    throw new Error(`Gemini upload init failed: ${await startRes.text()}`);
  }

  const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("Gemini did not return upload URL");

  // Step 2 — upload binary data
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`Gemini file upload failed: ${await uploadRes.text()}`);
  }

  const data = (await uploadRes.json()) as FileUploadResponse;
  return data.file.uri;
}

async function deleteFile(fileUri: string, apiKey: string): Promise<void> {
  // fileUri format: https://generativelanguage.googleapis.com/v1beta/files/{id}
  const fileId = fileUri.split("/files/")[1];
  if (!fileId) return;
  await fetch(`${API_BASE}/v1beta/files/${fileId}?key=${apiKey}`, { method: "DELETE" }).catch(() => undefined);
}

const buildPrompt = (channels: number): string => {
  const channelHint = channels > 1
    ? `IMPORTANT: This audio has ${channels} separate channels — each channel belongs to a different speaker. Use channel index as the speaker identifier (channel 0 = SPEAKER_1, channel 1 = SPEAKER_2, etc.).`
    : `Identify distinct speakers by voice characteristics and label them SPEAKER_1, SPEAKER_2, etc.`;

  return `Transcribe this audio file completely and accurately.
${channelHint}
Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "language": "detected language code, e.g. ru or en",
  "segments": [
    {
      "speaker": "SPEAKER_1",
      "startSec": 0.0,
      "endSec": 5.2,
      "text": "transcribed text"
    }
  ]
}

Rules:
- Each segment must contain a COMPLETE thought or sentence by one speaker — never split a sentence into multiple segments.
- Merge consecutive words from the same speaker into one segment, even if there are short pauses (under 2 seconds).
- Only start a new segment when: (a) the speaker changes, or (b) there is a clear sentence break with a pause over 2 seconds.
- Use accurate timestamps: startSec is the start of the segment, endSec is the end.
- Transcribe every word verbatim including filler words (ну, вот, э-э, ага, etc.).
- Do not translate — keep the original language exactly as spoken.
- Aim for 1–4 sentences per segment, not single words or short phrases.`;
};

const TRANSCRIPTION_PROMPT = `Transcribe this audio file completely and accurately.
Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "language": "detected language code, e.g. ru or en",
  "segments": [
    {
      "speaker": "SPEAKER_1",
      "startSec": 0.0,
      "endSec": 5.2,
      "text": "transcribed text"
    }
  ]
}

Rules:
- Identify distinct speakers and label them consistently: SPEAKER_1, SPEAKER_2, etc.
- Each segment must contain a COMPLETE thought or sentence by one speaker — never split a sentence into multiple segments.
- Merge consecutive words from the same speaker into one segment, even if there are short pauses (under 2 seconds).
- Only start a new segment when: (a) the speaker changes, or (b) there is a clear topic/sentence break with a pause over 2 seconds.
- Use accurate timestamps: startSec is the start of the segment, endSec is the end.
- Transcribe every word verbatim including filler words (ну, вот, э-э, ага, etc.).
- Do not translate — keep the original language exactly as spoken.
- Aim for 1–4 sentences per segment, not single words or short phrases.`;

export class GeminiTranscriptionProvider implements TranscriptionAdapter {
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    const apiKey = config.geminiApiKey;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const channels = await getAudioChannels(filePath);
    const prompt = buildPrompt(channels);

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext] ?? "audio/mpeg";
    const fileName = path.basename(filePath);

    const buffer = await readFile(filePath);
    const fileUri = await uploadFile(buffer, fileName, mimeType, apiKey);

    try {
      const genRes = await fetch(
        `${API_BASE}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { file_data: { mime_type: mimeType, file_uri: fileUri } },
                { text: prompt },
              ],
            }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0,
            },
          }),
        },
      );

      if (!genRes.ok) {
        throw new Error(`Gemini generateContent failed: ${await genRes.text()}`);
      }

      const genData = (await genRes.json()) as GenerateResponse;
      const rawText = genData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

      let parsed: GeminiOutput;
      try {
        parsed = JSON.parse(rawText) as GeminiOutput;
      } catch {
        throw new Error(`Gemini returned invalid JSON: ${rawText.slice(0, 200)}`);
      }

      const inputTokens = genData.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = genData.usageMetadata?.candidatesTokenCount ?? 0;
      const cost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

      const segments = (parsed.segments ?? []).map((seg) => ({
        speakerKey: seg.speaker ?? "SPEAKER_1",
        startSec: Number(seg.startSec) || 0,
        endSec: Number(seg.endSec) || 0,
        text: seg.text?.trim() ?? "",
      }));

      const fullText = segments.map((s) => s.text).join(" ");

      return {
        text: fullText,
        language: parsed.language ?? "unknown",
        segments,
        provider: "gemini",
        model: MODEL,
        cost: parseFloat(cost.toFixed(5)),
      };
    } finally {
      await deleteFile(fileUri, apiKey);
    }
  }
}
