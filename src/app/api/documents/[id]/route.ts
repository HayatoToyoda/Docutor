import { NextResponse } from "next/server";
import { getDocumentRepository } from "@/lib/server/document-repository";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const document = await getDocumentRepository().get(id);

  if (!document) {
    return jsonError("Document not found.", 404);
  }

  return NextResponse.json({ document });
}

// F-1 history dashboard: deletes a server document's whole directory
// (original upload, assets, job.json).
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await getDocumentRepository().delete(id);

  if (!deleted) {
    return jsonError("Document not found.", 404);
  }

  return NextResponse.json({ deleted: true });
}
