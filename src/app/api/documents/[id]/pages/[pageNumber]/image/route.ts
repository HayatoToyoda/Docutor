import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/server/http";
import { documentDir, readDocumentJob } from "@/lib/server/storage";

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

  const job = await readDocumentJob(id);

  if (!job?.normalizedDocument) {
    return jsonError("Page image not found.", 404);
  }

  const page = job.normalizedDocument.pages.find(
    (candidate) => candidate.pageNumber === parsedPageNumber,
  );

  if (!page?.imagePath) {
    return jsonError("Page image not found.", 404);
  }

  // Defense in depth: even though imagePath comes from our own Python
  // Worker output (not user input), verify it still resolves inside this
  // document's directory before reading it from disk. readDocumentJob()
  // above already validated `id`, so documentDir(id) cannot throw here.
  // Resolve both paths through realpath (not just path.resolve) so a
  // symlink inside the doc dir can't be used to escape it.
  let documentRoot: string;
  let resolvedImagePath: string;
  try {
    documentRoot = await realpath(documentDir(id));
    resolvedImagePath = await realpath(path.resolve(page.imagePath));
  } catch {
    return jsonError("Invalid asset path.", 404);
  }

  const relative = path.relative(documentRoot, resolvedImagePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return jsonError("Invalid asset path.", 400);
  }

  const extension = path.extname(resolvedImagePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType) {
    return jsonError("Unsupported asset type.", 400);
  }

  try {
    const data = await readFile(resolvedImagePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return jsonError("Page image could not be read.", 404);
  }
}
