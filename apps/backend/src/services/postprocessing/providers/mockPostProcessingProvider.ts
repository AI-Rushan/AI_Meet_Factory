import { ExtractedTask, PostprocessingAdapter, StructuredSummary } from "../types";

export class MockPostProcessingProvider implements PostprocessingAdapter {
  async summarize(_transcriptText: string): Promise<{ summary: StructuredSummary; cost: number }> {
    return {
      summary: {
        topics: ["Обсуждение целей встречи", "Запуск нового лендинга", "Интеграция CRM"],
        decisions: ["Запустить лендинг на следующей неделе", "Начать интеграцию с CRM"],
      },
      cost: 0,
    };
  }


  async extractTasks(_transcriptText: string): Promise<{ tasks: ExtractedTask[]; cost: number }> {
    return {
      tasks: [
        {
          text: "Подготовить новый лендинг",
          assignee: "ответственный не определен",
          dueDate: "срок не установлен",
        },
        {
          text: "Запустить интеграцию с CRM",
          assignee: "ответственный не определен",
          dueDate: "следующая неделя",
        },
      ],
      cost: 0,
    };
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
