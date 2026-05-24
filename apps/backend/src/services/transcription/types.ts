export type TranscriptionSegment = {
  speakerKey: string;
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscriptionResult = {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  provider: string;
  model: string;
  cost: number;
};

export interface TranscriptionAdapter {
  transcribe(filePath: string): Promise<TranscriptionResult>;
}

export type TranscriptionProvider = TranscriptionAdapter;
