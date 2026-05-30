import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config";
import { TranscriptionAdapter, TranscriptionResult } from "../types";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Gemini 2.0 Flash pricing via OpenRouter (per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-2.0-flash":          { input: 0.10, output: 0.40 },
  "google/gemini-2.5-flash-preview":  { input: 0.15, output: 0.60 },
  "google/gemini-3-flash-preview":    { input: 0.15, output: 0.60 },
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
  ".mkv":  "video/x-matroska",
};

// Prompt adapted from user's template — only transcription segments are used downstream
const PROMPT = `Please analyze this meeting recording and provide the following in JSON format:
{
  "language": "detected language code, e.g. ru or en",
  "segments": [
    { "speakerKey": "SPEAKER_1", "startSec": 0, "text": "..." }
  ],
  "summary": {
    "topics": ["Topic 1", "Topic 2"],
    "decisions": ["Decision 1", "Decision 2"]
  },
  "tasks": [
    { "text": "Task description", "assignee": "Name or 'ответственный не назначен'", "dueDate": "Date or 'срок не установлен'" }
  ]
}

Rules:
- Transcribe the entire meeting.
- Identify speakers as SPEAKER_1, SPEAKER_2, etc.
- startSec must be a number (seconds from start of recording), not a string.
- Extract all tasks, decisions, and topics discussed.
- If there is no assignee for a task, use "ответственный не назначен".
- If there is no deadline for a task, use "срок не установлен".
- Respond ONLY with valid JSON.`;

type OpenRouterResponse = {
  choices: Array<{
    message: { content: string };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
};

type ParsedOutput = {
  language?: string;
  segments?: Array<{
    speakerKey?: string;
    speaker?: string;
    startSec?: number;
    text?: string;
  }>;
};

export class OpenRouterTranscriptionProvider implements TranscriptionAdapter {
  private readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  async transcribe(filePath: string): Promise<TranscriptionResult> {
    const apiKey = config.openrouterApiKey;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext] ?? "audio/mpeg";

    const buffer = await readFile(filePath);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const body = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
            {
              type: "text",
              text: PROMPT,
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://app.sense-ai.ru",
        "X-Title": "AI Meet Factory",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as OpenRouterResponse;
    const rawText = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: ParsedOutput;
    try {
      parsed = JSON.parse(rawText) as ParsedOutput;
    } catch {
      throw new Error(`OpenRouter returned invalid JSON: ${rawText.slice(0, 300)}`);
    }

    const pricing = PRICING[this.model] ?? { input: 0.15, output: 0.60 };
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

    const segments = (parsed.segments ?? []).map((seg, i) => ({
      speakerKey: seg.speakerKey ?? seg.speaker ?? "SPEAKER_1",
      startSec: Number(seg.startSec) || 0,
      endSec: 0,
      text: seg.text?.trim() ?? "",
    }));

    const fullText = segments.map((s) => s.text).join(" ");

    return {
      text: fullText,
      language: parsed.language ?? "unknown",
      segments,
      provider: "openrouter",
      model: this.model,
      cost: parseFloat(cost.toFixed(5)),
    };
  }
}
