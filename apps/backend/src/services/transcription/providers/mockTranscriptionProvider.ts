import { TranscriptionAdapter, TranscriptionResult } from "../types";

export class MockTranscriptionProvider implements TranscriptionAdapter {
  async transcribe(_filePath: string): Promise<TranscriptionResult> {
    return {
      text:
        "Коллеги, привет. Давайте зафиксируем итоги. Нужен новый лендинг и запуск интеграции с CRM к следующей неделе.",
      language: "ru",
      segments: [
        {
          speakerKey: "SPEAKER_1",
          startSec: 0,
          endSec: 8,
          text: "Коллеги, привет. Давайте зафиксируем итоги.",
        },
        {
          speakerKey: "SPEAKER_2",
          startSec: 8,
          endSec: 20,
          text: "Нужен новый лендинг и запуск интеграции с CRM к следующей неделе.",
        },
      ],
      provider: "mock",
      model: "mock-transcribe-v1",
      cost: 0,
    };
  }
}
