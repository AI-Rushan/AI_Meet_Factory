export type ExtractedTask = {
  text: string;
  assignee: string | null;
  dueDate: string | null;
};

export type StructuredSummary = {
  topics: string[];
  decisions: string[];
};

export type AnalysisResult = {
  summary: StructuredSummary;
  tasks: ExtractedTask[];
};

export interface PostprocessingAdapter {
  analyze(transcriptText: string): Promise<{ result: AnalysisResult; cost: number }>;
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
