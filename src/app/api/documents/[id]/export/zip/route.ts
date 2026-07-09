import { buildDocumentZip } from "@/lib/export/zip";
import { getDocumentRepository } from "@/lib/server/document-repository";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const repository = getDocumentRepository();
  const document = await repository.get(id);

  if (!document?.reviewDocument) {
    return jsonError("Review document not found.", 404);
  }

  const zip = await buildDocumentZip(document, repository);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${document.id}.zip"`,
    },
  });
}
