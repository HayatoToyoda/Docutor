import { NextResponse } from "next/server";
import { detectSourceFileType } from "@/lib/file-types";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import { jsonError } from "@/lib/server/http";
import { createDocumentJob, StorageError } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Upload a document using the `file` form field.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("File is too large. The MVP limit is 25 MB.", 413);
  }

  const sourceFileType = detectSourceFileType(file.name, file.type);

  if (!sourceFileType) {
    return jsonError(
      "Unsupported file type. Upload PDF, DOCX, PPTX, PNG, or JPG.",
    );
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const job = await createDocumentJob({
      sourceFileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data,
    });

    return NextResponse.json({ document: job }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageError) {
      return jsonError(error.message);
    }

    console.error(error);
    return jsonError("Failed to create document job.", 500);
  }
}
