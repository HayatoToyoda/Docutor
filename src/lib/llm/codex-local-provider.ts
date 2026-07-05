import { spawn } from "node:child_process";
import {
  reviewDocumentSchema,
  reviewSectionSchema,
} from "@/lib/llm/review-document-schema";
import {
  normalizeReviewDocumentOutput,
  normalizeReviewSectionOutput,
} from "@/lib/llm/review-document-normalizer";
import {
  DOCUTOR_SYSTEM_PROMPT,
  buildDocumentConversionPrompt,
  buildSectionRegenerationPrompt,
} from "@/lib/llm/prompts";
import type {
  ConversionProvider,
  NormalizedDocument,
  ReviewDocument,
  ReviewSection,
} from "@/lib/types";

type JsonRpcMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

type CodexInput =
  | { type: "text"; text: string; text_elements: [] }
  | { type: "localImage"; path: string; detail: "high" | "auto" | "low" };

const CODEX_TIMEOUT_MS = 180_000;

export class CodexLocalProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexLocalProviderError";
  }
}

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

function buildCodexInputs(document: NormalizedDocument, prompt: string) {
  const inputs: CodexInput[] = [
    {
      type: "text",
      text: `${DOCUTOR_SYSTEM_PROMPT}\n\n${prompt}\n\nReturn only JSON. Do not edit files or run commands.`,
      text_elements: [],
    },
  ];

  for (const asset of document.assets.filter((asset) => asset.kind === "page-image").slice(0, 6)) {
    inputs.push({
      type: "localImage",
      path: asset.path,
      detail: "high",
    });
  }

  return inputs;
}

async function runCodexTurn(inputs: CodexInput[]) {
  if (process.env.DOCUTOR_ENABLE_CODEX_LOCAL !== "1") {
    throw new CodexLocalProviderError(
      "Codex local provider is disabled. Set DOCUTOR_ENABLE_CODEX_LOCAL=1 to use it.",
    );
  }

  return new Promise<string>((resolve, reject) => {
    const child = spawn("codex", ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let nextId = 0;
    let buffer = "";
    let assistantText = "";
    let settled = false;

    const timeout = setTimeout(() => {
      finish(new CodexLocalProviderError("Codex local provider timed out."));
    }, CODEX_TIMEOUT_MS);

    function finish(error?: Error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      child.kill();
      if (error) {
        reject(error);
      } else {
        resolve(assistantText);
      }
    }

    function send(message: Record<string, unknown>) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      if (!settled && String(chunk).includes("error")) {
        console.error(chunk);
      }
    });

    child.on("error", (error) => finish(error));
    child.on("exit", (code) => {
      if (!settled && code !== 0) {
        finish(
          new CodexLocalProviderError(
            `codex app-server exited with code ${code}.`,
          ),
        );
      }
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const message = JSON.parse(line) as JsonRpcMessage;
        if (message.error) {
          finish(new CodexLocalProviderError(message.error.message ?? "Codex app-server error."));
          return;
        }

        if (message.id === 0) {
          send({ method: "initialized", params: {} });
          send({
            method: "thread/start",
            id: ++nextId,
            params: {
              model: process.env.CODEX_MODEL,
            },
          });
          continue;
        }

        if (message.id === 1) {
          const thread = message.result?.thread as { id?: string } | undefined;
          if (!thread?.id) {
            finish(new CodexLocalProviderError("Codex thread/start did not return a thread id."));
            return;
          }
          send({
            method: "turn/start",
            id: ++nextId,
            params: {
              threadId: thread.id,
              input: inputs,
            },
          });
          continue;
        }

        if (message.method === "item/agentMessage/delta") {
          assistantText += String(message.params?.delta ?? "");
          continue;
        }

        if (message.method === "turn/completed") {
          finish();
        }
      }
    });

    send({
      method: "initialize",
      id: nextId,
      params: {
        clientInfo: {
          name: "docutor",
          title: "Docutor",
          version: "0.1.0",
        },
      },
    });
  });
}

export function createCodexLocalProvider(): ConversionProvider {
  return {
    name: "codex-local",
    async convert(input): Promise<ReviewDocument> {
      const responseText = await runCodexTurn(
        buildCodexInputs(input, buildDocumentConversionPrompt(input)),
      );
      return normalizeReviewDocumentOutput(
        reviewDocumentSchema.parse(JSON.parse(extractJson(responseText))),
      );
    },
    async regenerateSection(
      input: NormalizedDocument,
      section: ReviewSection,
    ): Promise<ReviewSection> {
      const responseText = await runCodexTurn(
        buildCodexInputs(input, buildSectionRegenerationPrompt(input, section)),
      );
      return normalizeReviewSectionOutput(
        reviewSectionSchema.parse(JSON.parse(extractJson(responseText))),
      );
    },
  };
}
