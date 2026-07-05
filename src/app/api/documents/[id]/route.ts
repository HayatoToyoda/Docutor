import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { readDocumentJob } from "@/lib/server/storage";

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
