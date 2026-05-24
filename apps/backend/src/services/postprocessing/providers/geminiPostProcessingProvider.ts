import { config } from "../../../config";
import { ExtractedTask, PostprocessingAdapter, StructuredSummary } from "../types";

const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL = "gemini-2.0-flash";

// Gemini 2.0 Flash pricing: $0.10/1M input, $0.40/1M output tokens
const INPUT_COST_PER_TOKEN = 0.10 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.40 / 1_000_000;

type GeminiResponse = {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
};

async function generate(
  systemInstruction: string,
  userText: string,
): Promise<{ text: string; cost: number }> {
  const apiKey = config.geminiApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const response = await fetch(
    `${API_BASE}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates[0]?.content?.parts[0]?.text ?? "";
  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  const cost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

  return { text, cost };
}

export class GeminiPostProcessingProvider implements PostprocessingAdapter {
  async summarize(transcriptText: string): Promise<{ summary: StructuredSummary; cost: number }> {
    const { text, cost } = await generate(
      'Ты помощник для обработки встреч. Верни JSON объект с двумя полями: "topics" — массив строк с ключевыми темами обсуждения (3-7 тем), "decisions" — массив строк с принятыми решениями (может быть пустым). Все строки на русском языке.',
      transcriptText,
    );

    let summary: StructuredSummary = { topics: [], decisions: [] };
    try {
      const parsed = JSON.parse(text) as Partial<StructuredSummary>;
      summary = {
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      };
    } catch {
      summary = { topics: [text], decisions: [] };
    }

    return { summary, cost };
  }

  async extractTasks(transcriptText: string): Promise<{ tasks: ExtractedTask[]; cost: number }> {
    const { text, cost } = await generate(
      'Извлеки задачи из транскрипции встречи. Верни JSON объект с полем "tasks" — массив объектов: {"text": "описание задачи", "assignee": "имя или null", "dueDate": "дата/срок или null"}. Все поля строковые или null.',
      transcriptText,
    );

    let tasks: ExtractedTask[] = [];
    try {
      const parsed = JSON.parse(text) as { tasks?: ExtractedTask[] };
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    } catch {
      tasks = [];
    }

    return { tasks, cost };
  }

  async suggestSpeakerNames(
    transcriptText: string,
    speakerLabels: string[],
  ): Promise<{ suggestions: Record<string, string>; cost: number }> {
    if (speakerLabels.length === 0) return { suggestions: {}, cost: 0 };

    const labelsStr = speakerLabels.join(", ");
    const { text, cost } = await generate(
      `Проанализируй транскрипцию и предложи имена для спикеров: ${labelsStr}. Верни JSON объект где ключи — метки спикеров, значения — предполагаемые имена на основе контекста. Если имя не определяется — используй "Участник N".`,
      transcriptText,
    );

    let suggestions: Record<string, string> = {};
    try {
      const parsed = JSON.parse(text) as Record<string, string>;
      suggestions = typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      speakerLabels.forEach((label, idx) => {
        suggestions[label] = idx === 0 ? "Ведущий" : `Участник ${idx}`;
      });
    }

    return { suggestions, cost };
  }

  async answerQuestion(
    transcriptText: string,
    question: string,
  ): Promise<{ answer: string; cost: number }> {
    const { text, cost } = await generate(
      "Ты помощник по анализу встреч. Отвечай на вопросы строго на основе предоставленной транскрипции. Если ответа нет в тексте — скажи об этом.",
      `Транскрипция встречи:\n${transcriptText}\n\nВопрос: ${question}`,
    );
    return { answer: text, cost };
  }
}
