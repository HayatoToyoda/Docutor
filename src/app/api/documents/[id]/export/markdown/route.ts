import { renderReviewDocumentMarkdown } from "@/lib/export/markdown";
import { jsonError } from "@/lib/server/http";
import { readDocumentJob } from "@/lib/server/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const document = await readDocumentJob(id);

  if (!document?.reviewDocument) {
    return jsonError("Review document not found.", 404);
  }

  const markdown = renderReviewDocumentMarkdown(document.reviewDocument);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${document.id}.md"`,
    },
  });
}
