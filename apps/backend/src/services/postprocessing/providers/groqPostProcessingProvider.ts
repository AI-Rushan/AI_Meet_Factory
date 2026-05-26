import { config } from "../../../config";
import { ANALYSIS_SYSTEM_PROMPT, parseAnalysisResult } from "../prompt";
import type { AnalysisResult, ExtractedTask, PostprocessingAdapter, StructuredSummary } from "../types";

// Groq LLaMA-3.3-70b — бесплатно (30 req/min, 6000 req/day)
const INPUT_COST_PER_TOKEN = 0;
const OUTPUT_COST_PER_TOKEN = 0;

type ChatMessage = { role: "system" | "user"; content: string };

type ChatResponse = {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

async function chat(messages: ChatMessage[], jsonMode = false): Promise<{ text: string; cost: number }> {
  const apiKey = config.groqApiKey;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.3,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Groq Chat API error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as ChatResponse;
  const text = data.choices[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const cost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

  return { text, cost };
}

export class GroqPostProcessingProvider implements PostprocessingAdapter {
  async analyze(transcriptText: string): Promise<{ result: AnalysisResult; cost: number }> {
    const { text, cost } = await chat(
      [{ role: "system", content: ANALYSIS_SYSTEM_PROMPT }, { role: "user", content: transcriptText }],
      true,
    );
    return { result: parseAnalysisResult(text), cost };
  }

  async summarize(transcriptText: string): Promise<{ summary: StructuredSummary; cost: number }> {
    const { result, cost } = await this.analyze(transcriptText);
    return { summary: result.summary, cost };
  }

  async extractTasks(transcriptText: string): Promise<{ tasks: ExtractedTask[]; cost: number }> {
    const { result, cost } = await this.analyze(transcriptText);
    return { tasks: result.tasks, cost };
  }

  async suggestSpeakerNames(
    transcriptText: string,
    speakerLabels: string[],
  ): Promise<{ suggestions: Record<string, string>; cost: number }> {
    if (speakerLabels.length === 0) return { suggestions: {}, cost: 0 };

    const { text, cost } = await chat(
      [
        {
          role: "system",
          content: `Проанализируй транскрипцию и предложи имена для спикеров: ${speakerLabels.join(", ")}. Верни JSON объект где ключи — метки спикеров, значения — предполагаемые имена на основе контекста разговора. Если имя не определяется — используй "Участник N".`,
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
        content: "Ты помощник по анализу встреч. Отвечай на вопросы пользователя строго на основе предоставленной транскрипции. Если ответа нет в тексте — скажи об этом.",
      },
      { role: "user", content: `Транскрипция встречи:\n${transcriptText}\n\nВопрос: ${question}` },
    ]);
    return { answer: text, cost };
  }
}
