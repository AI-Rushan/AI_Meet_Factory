export type ExtractedTask = {
  text: string;
  assignee: string | null;
  dueDate: string | null;
};

export type StructuredSummary = {
  topics: string[];
  decisions: string[];
};

export interface PostprocessingAdapter {
  summarize(transcriptText: string): Promise<{ summary: StructuredSummary; cost: number }>;
  extractTasks(transcriptText: string): Promise<{ tasks: ExtractedTask[]; cost: number }>;
  suggestSpeakerNames(
    transcriptText: string,
    speakerLabels: string[],
  ): Promise<{ suggestions: Record<string, string>; cost: number }>;
  answerQuestion(
    transcriptText: string,
    question: string,
  ): Promise<{ answer: string; cost: number }>;
}

export type PostProcessingProvider = PostprocessingAdapter;
