import { config } from "../../config";
import { MockPostProcessingProvider } from "./providers/mockPostProcessingProvider";
import { OpenAIPostProcessingProvider } from "./providers/openAIPostProcessingProvider";
import { PostprocessingAdapter } from "./types";

export const getPostProcessingProvider = (providerName?: string): PostprocessingAdapter => {
  const source = (providerName ?? config.postprocessingProvider).toLowerCase().trim();
  if (source === "openai") {
    return new OpenAIPostProcessingProvider();
  }
  return new MockPostProcessingProvider();
};
