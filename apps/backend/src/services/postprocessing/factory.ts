import { config } from "../../config";
import { GeminiPostProcessingProvider } from "./providers/geminiPostProcessingProvider";
import { GroqPostProcessingProvider } from "./providers/groqPostProcessingProvider";
import { MockPostProcessingProvider } from "./providers/mockPostProcessingProvider";
import { OpenAIPostProcessingProvider } from "./providers/openAIPostProcessingProvider";
import { PostprocessingAdapter } from "./types";

export const getPostProcessingProvider = (providerName?: string): PostprocessingAdapter => {
  const source = (providerName ?? config.postprocessingProvider).toLowerCase().trim();
  if (source === "openai") return new OpenAIPostProcessingProvider();
  if (source === "gemini") return new GeminiPostProcessingProvider();
  if (source === "groq") return new GroqPostProcessingProvider();
  return new MockPostProcessingProvider();
};
