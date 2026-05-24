import { config } from "../../config";
import { AssemblyAITranscriptionProvider } from "./providers/assemblyAITranscriptionProvider";
import { DeepgramTranscriptionProvider } from "./providers/deepgramTranscriptionProvider";
import { GeminiTranscriptionProvider } from "./providers/geminiTranscriptionProvider";
import { GladiaTranscriptionProvider } from "./providers/gladiaTranscriptionProvider";
import { GroqTranscriptionProvider } from "./providers/groqTranscriptionProvider";
import { MockTranscriptionProvider } from "./providers/mockTranscriptionProvider";
import { OllamaTranscriptionProvider } from "./providers/ollamaTranscriptionProvider";
import { OpenAITranscriptionProvider } from "./providers/openaiTranscriptionProvider";
import { WhisperLocalProvider } from "./providers/whisperLocalProvider";
import { TranscriptionAdapter } from "./types";

export const getTranscriptionProvider = (providerName?: string): TranscriptionAdapter => {
  const source = providerName ?? config.transcriptionProvider;
  switch (source) {
    case "openai":        return new OpenAITranscriptionProvider();
    case "groq":          return new GroqTranscriptionProvider();
    case "gladia":        return new GladiaTranscriptionProvider();
    case "deepgram":      return new DeepgramTranscriptionProvider();
    case "assemblyai":    return new AssemblyAITranscriptionProvider();
    case "whisper-local": return new WhisperLocalProvider();
    case "ollama":        return new OllamaTranscriptionProvider();
    case "gemini":        return new GeminiTranscriptionProvider();
    default:              return new MockTranscriptionProvider();
  }
};
