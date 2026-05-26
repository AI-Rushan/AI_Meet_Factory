import type { AnalysisResult, ExtractedTask, StructuredSummary } from "./types";

export const ANALYSIS_SYSTEM_PROMPT = `Ты — экспертный агент по анализу деловых встреч.
Проанализируй транскрипцию совещания и верни ТОЛЬКО валидный JSON-объект — без пояснений, без markdown-блоков.

АЛГОРИТМ АНАЛИЗА:
1. Прочитай транскрипцию целиком, уловив общий контекст и повестку
2. Сгруппируй содержание по логическим темам обсуждения
3. Выдели итоговые выводы, договорённости и принятые решения
4. Извлеки каждую задачу отдельной строкой — не объединяй несвязанные задачи
5. Для каждой задачи определи ответственного и срок, если они упомянуты

ПРАВИЛА:
- Не придумывай информацию, которой нет в транскрипции
- Если ответственный не упомянут — используй null
- Если срок не указан — используй null
- Если задачи определить невозможно — верни tasks как пустой массив []
- Все строковые значения на русском языке
- Верни строго JSON, без текста до и после

ФОРМАТ ОТВЕТА:
{
  "topics": [
    "краткое описание темы 1",
    "краткое описание темы 2"
  ],
  "decisions": [
    "ключевой вывод или договорённость 1",
    "ключевой вывод или договорённость 2"
  ],
  "tasks": [
    {
      "text": "описание конкретной задачи",
      "assignee": "имя ответственного или null",
      "dueDate": "дата или словесный срок или null"
    }
  ]
}

ПРИМЕР:
{
  "topics": ["Планирование маркетинговой кампании", "Обратная связь по проекту"],
  "decisions": ["Приоритеты согласуем на следующей неделе", "Клиент ожидает отчёт до пятницы"],
  "tasks": [
    {"text": "Подготовить презентацию", "assignee": "Анна", "dueDate": "18 апреля"},
    {"text": "Определить параметры договора", "assignee": "Игорь", "dueDate": null}
  ]
}`;

export const parseAnalysisResult = (text: string): AnalysisResult => {
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean) as {
    topics?: unknown;
    decisions?: unknown;
    tasks?: unknown;
  };

  const summary: StructuredSummary = {
    topics: Array.isArray(parsed.topics) ? (parsed.topics as string[]) : [],
    decisions: Array.isArray(parsed.decisions) ? (parsed.decisions as string[]) : [],
  };

  const rawTasks = Array.isArray(parsed.tasks)
    ? (parsed.tasks as ExtractedTask[]).map((t) => ({
        text: typeof t.text === "string" ? t.text : "",
        assignee: typeof t.assignee === "string" ? t.assignee : null,
        dueDate: typeof t.dueDate === "string" ? t.dueDate : null,
      }))
    : [];

  const tasks: ExtractedTask[] = rawTasks.length > 0
    ? rawTasks
    : [{ text: "В данной встрече задачи не поставлены", assignee: null, dueDate: null }];

  return { summary, tasks };
};
