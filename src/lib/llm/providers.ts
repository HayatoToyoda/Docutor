import { createAnthropicProvider } from "@/lib/llm/anthropic-provider";
import { createCodexLocalProvider } from "@/lib/llm/codex-local-provider";
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

  if (providerName === "anthropic") {
    return createAnthropicProvider();
  }

  if (providerName === "mock") {
    return createMockProvider();
  }

  if (providerName === "codex-local") {
    return createCodexLocalProvider();
  }

  throw new Error("Unsupported conversion provider.");
}
