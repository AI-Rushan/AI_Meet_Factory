export type ProcessingStepName =
  | "file_received"
  | "transcription_requested"
  | "transcription_completed"
  | "source_deleted"
  | "speakers_identified"
  | "summary_completed"
  | "tasks_extracted"
  | "meeting_qa_prepared"
  | "results_saved"
  | "processing_completed";

export type ModelPurpose = "transcription" | "postprocessing";

export type RunStatus = "queued" | "running" | "success" | "failed";

export type ProcessingStepStatus = "started" | "success" | "failed";

export type SegmentDto = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  speakerId: string | null;
};

export type SpeakerDto = {
  id: string;
  label: string;
  suggestedName: string | null;
  finalName: string | null;
};

export type TaskItemDto = {
  id: string;
  autoText: string;
  finalText: string;
  autoAssignee: string | null;
  finalAssignee: string | null;
  autoDueDate: string | null;
  finalDueDate: string | null;
  done: boolean;
};
