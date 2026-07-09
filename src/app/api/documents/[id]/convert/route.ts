import { NextResponse } from "next/server";
import { createConversionProvider } from "@/lib/llm/providers";
import { jsonError } from "@/lib/server/http";
import { runPythonWorker } from "@/lib/server/python-worker";
import {
  readDocumentJob,
  saveDocumentJob,
  setDocumentJobStatus,
} from "@/lib/server/storage";
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
  const document = await readDocumentJob(id);

  if (!document) {
    return jsonError("Document not found.", 404);
  }

  let providerName: ConversionProviderName | undefined;
  try {
    providerName = providerFromRequest(request);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }

  await setDocumentJobStatus(id, "normalizing");

  try {
    const workerResult = await runPythonWorker(document);
    const normalizedJob = await saveDocumentJob({
      ...document,
      status: "converting",
      normalizedDocument: workerResult.document,
      error: undefined,
    });

    const provider = createConversionProvider(providerName);
    const reviewDocument = await provider.convert(workerResult.document);

    const readyJob = await saveDocumentJob({
      ...normalizedJob,
      status: "ready",
      normalizedDocument: workerResult.document,
      reviewDocument,
      error: undefined,
    });

    return NextResponse.json({ document: readyJob });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document conversion failed.";
    const failedJob = await setDocumentJobStatus(id, "failed", message);
    return NextResponse.json(
      { document: failedJob, error: message },
      { status: 500 },
    );
  }
}
