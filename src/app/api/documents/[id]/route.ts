import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { deleteDocumentJob, readDocumentJob } from "@/lib/server/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const document = await readDocumentJob(id);

  if (!document) {
    return jsonError("Document not found.", 404);
  }

  return NextResponse.json({ document });
}

// F-1 history dashboard: deletes a server document's whole directory
// (original upload, assets, job.json).
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteDocumentJob(id);

  if (!deleted) {
    return jsonError("Document not found.", 404);
  }

  return NextResponse.json({ deleted: true });
}
