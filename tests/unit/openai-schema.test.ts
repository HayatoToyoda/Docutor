import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import { reviewDocumentSchema } from "../../src/lib/llm/review-document-schema";

describe("OpenAI review document schema", () => {
  it("can be converted to a strict structured output format", () => {
    expect(() =>
      zodTextFormat(reviewDocumentSchema, "review_document"),
    ).not.toThrow();
  });
});
