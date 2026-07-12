import { NextResponse } from "next/server";
import {
  convertDocumentInChunks,
  resolvePagesPerChunk,
  splitIntoPageWindows,
} from "@/lib/llm/chunked-convert";
import { createConversionProvider } from "@/lib/llm/providers";
import { getDocumentRepository } from "@/lib/server/document-repository";
import { jsonError } from "@/lib/server/http";
import { runPythonWorker } from "@/lib/server/python-worker";
import type { ConversionProviderName } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function providerFromRequest(request: Request): ConversionProviderName | undefined {
  const provider = new URL(request.url).searchParams.get("provider");
  if (!provider) {
    return undefined;
  }

  if (
    provider === "openai" ||
    provider === "anthropic" ||
    provider === "mock" ||
    provider === "codex-local"
  ) {
    return provider;
  }

  throw new Error("Unsupported conversion provider.");
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const repository = getDocumentRepository();
  const document = await repository.get(id);

  if (!document) {
    return jsonError("Document not found.", 404);
  }

  let providerName: ConversionProviderName | undefined;
  try {
    providerName = providerFromRequest(request);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }

  await repository.setStatus(id, "normalizing");

  try {
    const workerResult = await runPythonWorker(document);
    const normalizedJob = await repository.save({
      ...document,
      status: "converting",
      normalizedDocument: workerResult.document,
      error: undefined,
    });

    const provider = createConversionProvider(providerName);

    // F-10: large documents are converted in page windows (see
    // chunked-convert.ts) rather than a single provider.convert call.
    // windows/totalPages are only used to render a human-readable
    // statusDetail ("Converting pages 7-12 of 23...") for pollers — the
    // actual windowing/merging happens inside convertDocumentInChunks.
    const pagesPerChunk = resolvePagesPerChunk();
    const windows = splitIntoPageWindows(
      workerResult.document.pages,
      pagesPerChunk,
    );
    const totalPages = workerResult.document.pages.length;

    const reviewDocument = await convertDocumentInChunks(
      provider,
      workerResult.document,
      {
        pagesPerChunk,
        onChunkProgress: async (completed, total) => {
          const window = windows[completed - 1];
          if (total <= 1 || !window) {
            return;
          }
          await repository.update(id, {
            statusDetail: `Converting pages ${window.startPage}-${window.endPage} of ${totalPages}…`,
          });
        },
      },
    );

    const readyJob = await repository.save({
      ...normalizedJob,
      status: "ready",
      normalizedDocument: workerResult.document,
      reviewDocument,
      error: undefined,
      statusDetail: undefined,
    });

    return NextResponse.json({ document: readyJob });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document conversion failed.";
    const failedJob = await repository.setStatus(id, "failed", message);
    return NextResponse.json(
      { document: failedJob, error: message },
      { status: 500 },
    );
  }
}
