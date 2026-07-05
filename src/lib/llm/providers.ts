import { createMockProvider } from "@/lib/llm/mock-provider";
import { createOpenAIProvider } from "@/lib/llm/openai-provider";
import type { ConversionProvider, ConversionProviderName } from "@/lib/types";

export function createConversionProvider(
  providerName: ConversionProviderName =
    (process.env.DOCUTOR_LLM_PROVIDER as ConversionProviderName | undefined) ??
    "openai",
): ConversionProvider {
  if (providerName === "openai") {
    return createOpenAIProvider();
  }

  if (providerName === "mock") {
    return createMockProvider();
  }

  throw new Error(
    "Codex local provider is not implemented yet. Use DOCUTOR_LLM_PROVIDER=openai or mock.",
  );
}
