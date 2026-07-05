import { notImplemented } from "@/lib/server/http";
import { readDocumentJob } from "@/lib/server/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const document = await readDocumentJob(id);

  if (!document) {
    return notImplemented("Document not found.");
  }

  return notImplemented(
    "Document conversion will be available after the Python Worker and LLM provider are wired.",
  );
}
