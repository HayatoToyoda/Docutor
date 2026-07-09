import path from "node:path";
import { getDocumentRepository } from "@/lib/server/document-repository";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; pageNumber: string }>;
};

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, pageNumber } = await context.params;
  const parsedPageNumber = Number(pageNumber);

  if (!Number.isInteger(parsedPageNumber) || parsedPageNumber < 1) {
    return jsonError("Invalid page number.", 400);
  }

  const repository = getDocumentRepository();
  const job = await repository.get(id);

  if (!job?.normalizedDocument) {
    return jsonError("Page image not found.", 404);
  }

  const page = job.normalizedDocument.pages.find(
    (candidate) => candidate.pageNumber === parsedPageNumber,
  );

  if (!page?.imagePath) {
    return jsonError("Page image not found.", 404);
  }

  const extension = path.extname(page.imagePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType) {
    return jsonError("Unsupported asset type.", 400);
  }

  // Defense in depth: even though imagePath comes from our own Python
  // Worker output (not user input), the repository verifies it still
  // resolves inside this document's storage scope before reading it (see
  // FilesystemDocumentRepository.readAsset). readAsset returns null both
  // for a missing file and for an out-of-scope path, so both collapse into
  // the same 404 here.
  const data = await repository.readAsset(id, page.imagePath);

  if (!data) {
    return jsonError("Page image could not be read.", 404);
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
