import { config } from "../../../config";
import { ExtractedTask, PostprocessingAdapter, StructuredSummary } from "../types";

// GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
const INPUT_COST_PER_TOKEN = 0.15 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.60 / 1_000_000;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatResponse = {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

async function chat(messages: ChatMessage[], jsonMode = false): Promise<{ text: string; cost: number }> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Chat API error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as ChatResponse;
  const text = data.choices[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const cost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

  return { text, cost };
}

export class OpenAIPostProcessingProvider implements PostprocessingAdapter {
  async summarize(transcriptText: string): Promise<{ summary: StructuredSummary; cost: number }> {
    const { text, cost } = await chat(
      [
        {
          role: "system",
          content:
            'Ты помощник для обработки встреч. Верни JSON объект с двумя полями: "topics" — массив строк с ключевыми темами обсуждения (3-7 тем), "decisions" — массив строк с принятыми решениями (может быть пустым). Все строки на русском языке.',
        },
        { role: "user", content: transcriptText },
      ],
      true,
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
    const { text, cost } = await chat(
      [
        {
          role: "system",
          content:
            'Извлеки задачи из транскрипции встречи. Верни JSON объект с полем "tasks" — массив объектов: {"text": "описание задачи", "assignee": "имя или null", "dueDate": "дата/срок или null"}. Все поля строковые или null.',
        },
        { role: "user", content: transcriptText },
      ],
      true,
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
    const { text, cost } = await chat(
      [
        {
          role: "system",
          content: `Проанализируй транскрипцию и предложи имена для спикеров: ${labelsStr}. Верни JSON объект где ключи — метки спикеров, значения — предполагаемые имена на основе контекста разговора. Если имя не определяется — используй "Участник N".`,
        },
        { role: "user", content: transcriptText },
      ],
      true,
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
    const { text, cost } = await chat([
      {
        role: "system",
        content:
          "Ты помощник по анализу встреч. Отвечай на вопросы пользователя строго на основе предоставленной транскрипции. Если ответа нет в тексте — скажи об этом.",
      },
      {
        role: "user",
        content: `Транскрипция встречи:\n${transcriptText}\n\nВопрос: ${question}`,
      },
    ]);
    return { answer: text, cost };
  }
}
