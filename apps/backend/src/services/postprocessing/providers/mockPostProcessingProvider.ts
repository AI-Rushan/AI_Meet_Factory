import { AnalysisResult, ExtractedTask, PostprocessingAdapter, StructuredSummary } from "../types";

const MOCK_RESULT: AnalysisResult = {
  summary: {
    topics: ["Обсуждение целей встречи", "Запуск нового лендинга", "Интеграция CRM"],
    decisions: ["Запустить лендинг на следующей неделе", "Начать интеграцию с CRM"],
  },
  tasks: [
    { text: "Подготовить новый лендинг", assignee: null, dueDate: null },
    { text: "Запустить интеграцию с CRM", assignee: null, dueDate: "следующая неделя" },
  ],
};

export class MockPostProcessingProvider implements PostprocessingAdapter {
  async analyze(_transcriptText: string): Promise<{ result: AnalysisResult; cost: number }> {
    return { result: MOCK_RESULT, cost: 0 };
  }

  async summarize(_transcriptText: string): Promise<{ summary: StructuredSummary; cost: number }> {
    return { summary: MOCK_RESULT.summary, cost: 0 };
  }

  async extractTasks(_transcriptText: string): Promise<{ tasks: ExtractedTask[]; cost: number }> {
    return { tasks: MOCK_RESULT.tasks, cost: 0 };
  }

  async suggestSpeakerNames(
    _transcriptText: string,
    speakerLabels: string[],
  ): Promise<{ suggestions: Record<string, string>; cost: number }> {
    const suggestions: Record<string, string> = {};
    speakerLabels.forEach((label, idx) => {
      suggestions[label] = idx === 0 ? "Ведущий" : `Участник ${idx}`;
    });
    return { suggestions, cost: 0 };
  }

  async answerQuestion(
    transcriptText: string,
    question: string,
  ): Promise<{ answer: string; cost: number }> {
    return {
      answer: `Ответ сформирован по транскрипции (${transcriptText.slice(0, 120)}...). Вопрос: ${question}`,
      cost: 0,
    };
  }
}
