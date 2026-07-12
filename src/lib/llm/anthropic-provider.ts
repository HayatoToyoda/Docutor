import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Message,
  Tool,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import {
  reviewDocumentSchema,
  reviewSectionSchema,
} from "@/lib/llm/review-document-schema";
import {
  normalizeReviewDocument,
  normalizeReviewSection,
} from "@/lib/llm/review-document-normalizer";
import {
  DOCUTOR_SYSTEM_PROMPT,
  buildDocumentConversionPrompt,
  buildSectionRegenerationPrompt,
} from "@/lib/llm/prompts";
import {
  appendPageImageTruncationWarning,
  collectPageImages,
} from "@/lib/llm/page-images";
import type { ConversionProvider, NormalizedDocument } from "@/lib/types";

const DEFAULT_MODEL = "claude-sonnet-5";
// Document conversions produce many sections at once (potentially with
// draw.io XML), so this needs to be generous — well above the OpenAI
// provider's typical output, which is naturally bounded by the Responses API
// default.
const MAX_TOKENS = 32000;

// Exported (alongside the two schema constants below) so tests can verify
// the generated tool schemas agree with reviewDocumentSchema /
// reviewSectionSchema without duplicating the conversion logic.
export const REVIEW_DOCUMENT_TOOL_NAME = "submit_review_document";
export const REVIEW_SECTION_TOOL_NAME = "submit_review_section";

export class AnthropicProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnthropicProviderError";
  }
}

type ToolInputSchema = Tool["input_schema"];

/**
 * Converts a zod schema into the JSON Schema shape Anthropic's tool
 * `input_schema` expects, using zod v4's built-in converter. Keeping this a
 * thin wrapper (rather than hand-writing the schema) means the tool
 * definition Claude sees can never drift from reviewDocumentSchema /
 * reviewSectionSchema, the same zod schemas used to parse its output below —
 * zod stays the single source of truth for both directions.
 *
 * reviewSectionSchema is a union of two object schemas, so zod emits a
 * top-level `anyOf` with no `type` key; `type: "object"` is added
 * unconditionally to satisfy Anthropic's input_schema (and the SDK's
 * TypeScript type for it), which is harmless for reviewDocumentSchema since
 * its generated schema is already `type: "object"`.
 */
export function buildToolInputSchema(schema: z.core.$ZodType): ToolInputSchema {
  const generated = z.toJSONSchema(schema) as unknown as Record<
    string,
    unknown
  >;
  return {
    ...generated,
    type: "object",
  } as ToolInputSchema;
}

export const reviewDocumentToolInputSchema = buildToolInputSchema(
  reviewDocumentSchema,
);
export const reviewSectionToolInputSchema = buildToolInputSchema(
  reviewSectionSchema,
);

function reviewDocumentTool(): Tool {
  return {
    name: REVIEW_DOCUMENT_TOOL_NAME,
    description:
      "Submit the fully converted review document: title, sections, and warnings.",
    input_schema: reviewDocumentToolInputSchema,
  };
}

function reviewSectionTool(): Tool {
  return {
    name: REVIEW_SECTION_TOOL_NAME,
    description: "Submit exactly one regenerated review section.",
    input_schema: reviewSectionToolInputSchema,
  };
}

function createClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnthropicProviderError(
      "ANTHROPIC_API_KEY is required for the Anthropic conversion provider.",
    );
  }

  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function toAnthropicImageMediaType(
  mimeType: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/gif" ||
    mimeType === "image/webp"
  ) {
    return mimeType;
  }
  // The Python worker only ever emits page images as PNG (see
  // workers/python/worker.py); this default only matters if that ever
  // changes to a format Anthropic's Base64ImageSource doesn't enumerate.
  return "image/png";
}

async function imagePathToBase64(path: string) {
  const data = await readFile(path);
  return data.toString("base64");
}

async function buildUserContent(document: NormalizedDocument) {
  const content: ContentBlockParam[] = [
    {
      type: "text",
      text: buildDocumentConversionPrompt(document),
    },
  ];

  const { pageImages, truncatedPageImageCount } = collectPageImages(document);

  for (const asset of pageImages) {
    try {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: toAnthropicImageMediaType(asset.mimeType),
          data: await imagePathToBase64(asset.path),
        },
      });
    } catch {
      content.push({
        type: "text",
        text: `Unclear: Page image could not be loaded from ${asset.path}.`,
      });
    }
  }

  return { content, truncatedPageImageCount };
}

function extractToolInput(response: Message, toolName: string): unknown {
  const toolUse = response.content.find(
    (block): block is ToolUseBlock =>
      block.type === "tool_use" && block.name === toolName,
  );

  if (!toolUse) {
    throw new AnthropicProviderError(
      `Anthropic did not return a ${toolName} tool call.`,
    );
  }

  return toolUse.input;
}

async function convertContent(
  source: NormalizedDocument,
  content: ContentBlockParam[],
) {
  const client = createClient();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: DOCUTOR_SYSTEM_PROMPT,
    tools: [reviewDocumentTool()],
    tool_choice: { type: "tool", name: REVIEW_DOCUMENT_TOOL_NAME },
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  const toolInput = extractToolInput(response, REVIEW_DOCUMENT_TOOL_NAME);
  // zod stays the source of truth: the tool schema only steers the model's
  // output shape, the parse below is what's actually trusted.
  const parsed = reviewDocumentSchema.parse(toolInput);
  return normalizeReviewDocument(parsed, source);
}

export function createAnthropicProvider(): ConversionProvider {
  return {
    name: "anthropic",
    async convert(input) {
      const { content, truncatedPageImageCount } =
        await buildUserContent(input);
      const reviewDocument = await convertContent(input, content);
      return appendPageImageTruncationWarning(
        reviewDocument,
        truncatedPageImageCount,
      );
    },
    async regenerateSection(input, section, options) {
      const client = createClient();
      const { content } = await buildUserContent(input);
      content.push({
        type: "text",
        text: buildSectionRegenerationPrompt(
          input,
          section,
          options?.instruction,
        ),
      });

      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system: DOCUTOR_SYSTEM_PROMPT,
        tools: [reviewSectionTool()],
        tool_choice: { type: "tool", name: REVIEW_SECTION_TOOL_NAME },
        messages: [
          {
            role: "user",
            content,
          },
        ],
      });

      const toolInput = extractToolInput(response, REVIEW_SECTION_TOOL_NAME);
      const parsed = reviewSectionSchema.parse(toolInput);
      return normalizeReviewSection(parsed, section);
    },
  };
}
