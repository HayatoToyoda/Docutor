import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
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
  buildDirectSectionRegenerationPrompt,
  buildDocumentConversionPrompt,
  buildSectionRegenerationPrompt,
} from "@/lib/llm/prompts";
import {
  appendPageImageTruncationWarning,
  collectPageImages,
} from "@/lib/llm/page-images";
import type {
  ConversionProvider,
  NormalizedDocument,
  RegenerateSectionOptions,
  ReviewSection,
  SourceFileType,
} from "@/lib/types";

const DEFAULT_MODEL = "gpt-5.5";

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

// Page images attached as vision content (capped at MAX_PAGE_IMAGES),
// shared by convert and regenerateSection. Only the leading text block
// differs per task: convert prepends the document-conversion prompt, while
// regeneration prepends buildSectionRegenerationPrompt — which already
// embeds the document context, so seeding the conversion prompt there too
// would send the entire normalized-document JSON twice and instruct the
// model to convert the whole document (issue #17).
async function buildPageImageContent(document: NormalizedDocument) {
  const content: ResponseInputContent[] = [];
  const { pageImages, truncatedPageImageCount } = collectPageImages(document);

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

  return { content, truncatedPageImageCount };
}

async function buildUserContent(document: NormalizedDocument) {
  const { content: imageContent, truncatedPageImageCount } =
    await buildPageImageContent(document);

  const content: ResponseInputContent[] = [
    {
      type: "input_text",
      text: buildDocumentConversionPrompt(document),
    },
    ...imageContent,
  ];

  return { content, truncatedPageImageCount };
}

function createClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new OpenAIProviderError(
      "OPENAI_API_KEY is required for the OpenAI conversion provider.",
    );
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function convertContent(
  source: NormalizedDocument,
  content: ResponseInputContent[],
) {
  const response = await createClient().responses.parse({
    model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content: DOCUTOR_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content,
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

  return normalizeReviewDocument(response.output_parsed, source);
}

export async function convertFileWithOpenAI(input: {
  id: string;
  sourceFileName: string;
  fileType: SourceFileType;
  mimeType: string;
  data: Buffer;
}) {
  const source: NormalizedDocument = {
    id: input.id,
    sourceFileName: input.sourceFileName,
    fileType: input.fileType,
    createdAt: new Date().toISOString(),
    pages: [],
    assets: [],
    warnings: [],
  };
  const dataUrl = `data:${input.mimeType};base64,${input.data.toString("base64")}`;
  const fileContent: ResponseInputContent =
    input.fileType === "image"
      ? {
          type: "input_image",
          image_url: dataUrl,
          detail: "high",
        }
      : {
          type: "input_file",
          filename: input.sourceFileName,
          file_data: dataUrl,
        };

  const reviewDocument = await convertContent(source, [
    fileContent,
    {
      type: "input_text",
      text: `${buildDocumentConversionPrompt(source)}\n\nThe source file is attached directly. Read its contents from the attached file.`,
    },
  ]);

  if (input.fileType === "image") {
    // The direct-upload flow never runs the Python Worker, so the model has
    // no persistent page-image path to reference. The uploaded image itself
    // *is* the single source page; the caller attaches it once as
    // `directSourceImage` on the stored document rather than duplicating the
    // data URL onto every section (which would blow the localStorage quota
    // and the regeneration prompt's context window).
    return reviewDocument;
  }

  return {
    ...reviewDocument,
    warnings: [
      ...reviewDocument.warnings,
      "Original page image comparison is only available when documents are converted through the server pipeline (POST /api/documents/:id/convert).",
    ],
  };
}

/**
 * Regenerates a single section for the direct-upload flow, where only the
 * previously generated review document (not the original file bytes) is
 * available server-side. Used by the stateless /api/convert-direct/regenerate
 * endpoint so hosted/demo documents get a real LLM regeneration instead of a
 * client-side placeholder.
 */
export async function regenerateDirectSection(
  document: {
    title: string;
    sourceFileName: string;
    sourceFileType: SourceFileType;
    sections: ReviewSection[];
  },
  section: ReviewSection,
  options?: RegenerateSectionOptions,
) {
  const client = createClient();
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content: DOCUTOR_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildDirectSectionRegenerationPrompt(
              document,
              section,
              options?.instruction,
            ),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(reviewSectionSchema, "review_section"),
    },
  });

  if (!response.output_parsed) {
    throw new OpenAIProviderError(
      "OpenAI regeneration did not return a parsed review section.",
    );
  }

  return normalizeReviewSection(response.output_parsed, section);
}

export function createOpenAIProvider(): ConversionProvider {
  return {
    name: "openai",
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
      const { content: imageContent } = await buildPageImageContent(input);
      const content: ResponseInputContent[] = [
        {
          type: "input_text",
          text: buildSectionRegenerationPrompt(
            input,
            section,
            options?.instruction,
          ),
        },
        ...imageContent,
      ];

      const response = await client.responses.parse({
        model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content: DOCUTOR_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content,
          },
        ],
        text: {
          format: zodTextFormat(reviewSectionSchema, "review_section"),
        },
      });

      if (!response.output_parsed) {
        throw new OpenAIProviderError(
          "OpenAI regeneration did not return a parsed review section.",
        );
      }

      return normalizeReviewSection(response.output_parsed, section);
    },
  };
}
