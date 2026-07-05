import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  reviewDocumentSchema,
  type ReviewDocumentOutput,
} from "@/lib/llm/review-document-schema";
import {
  DOCUTOR_SYSTEM_PROMPT,
  buildDocumentConversionPrompt,
} from "@/lib/llm/prompts";
import type {
  ConversionProvider,
  NormalizedDocument,
  ReviewDocument,
} from "@/lib/types";

const DEFAULT_MODEL = "gpt-5.5";
const MAX_PAGE_IMAGES = 6;

export class OpenAIProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIProviderError";
  }
}

async function imagePathToDataUrl(path: string, mimeType = "image/png") {
  const data = await readFile(path);
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

async function buildUserContent(document: NormalizedDocument) {
  const content: ResponseInputContent[] = [
    {
      type: "input_text",
      text: buildDocumentConversionPrompt(document),
    },
  ];

  const pageImages = document.assets
    .filter((asset) => asset.kind === "page-image")
    .slice(0, MAX_PAGE_IMAGES);

  for (const asset of pageImages) {
    try {
      content.push({
        type: "input_image",
        image_url: await imagePathToDataUrl(asset.path, asset.mimeType),
        detail: "high",
      });
    } catch {
      content.push({
        type: "input_text",
        text: `Unclear: Page image could not be loaded from ${asset.path}.`,
      });
    }
  }

  return content;
}

function normalizeReviewDocument(
  output: ReviewDocumentOutput,
  source: NormalizedDocument,
): ReviewDocument {
  const now = new Date().toISOString();

  return {
    ...output,
    id: source.id,
    sourceFileName: source.sourceFileName,
    sourceFileType: source.fileType,
    createdAt: output.createdAt || now,
    updatedAt: now,
    sections: output.sections.map((section) => ({
      ...section,
      reviewStatus: "pending",
    })),
    warnings: [...source.warnings, ...output.warnings],
  } as ReviewDocument;
}

export function createOpenAIProvider(): ConversionProvider {
  return {
    name: "openai",
    async convert(input) {
      if (!process.env.OPENAI_API_KEY) {
        throw new OpenAIProviderError(
          "OPENAI_API_KEY is required for the OpenAI conversion provider.",
        );
      }

      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const response = await client.responses.parse({
        model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content: DOCUTOR_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: await buildUserContent(input),
          },
        ],
        text: {
          format: zodTextFormat(reviewDocumentSchema, "review_document"),
        },
      });

      if (!response.output_parsed) {
        throw new OpenAIProviderError(
          "OpenAI conversion did not return a parsed review document.",
        );
      }

      return normalizeReviewDocument(response.output_parsed, input);
    },
  };
}
