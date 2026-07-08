import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectSourceFileType, sourceFileExtension } from "@/lib/file-types";
import type { DocumentJobStatus, StoredDocumentJob } from "@/lib/types";

const STORAGE_ROOT = path.join(process.cwd(), "runtime", "documents");

// Document ids are generated with randomUUID() or a "direct-"/"demo-" prefix
// plus a UUID. Restricting to this charset keeps documentDir() from ever
// escaping STORAGE_ROOT via a crafted id (e.g. "..").
const SAFE_DOCUMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isSafeDocumentId(documentId: string) {
  return SAFE_DOCUMENT_ID_PATTERN.test(documentId);
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export function documentDir(documentId: string) {
  if (!isSafeDocumentId(documentId)) {
    throw new StorageError("Invalid document id.");
  }
  return path.join(STORAGE_ROOT, documentId);
}

export function jobMetadataPath(documentId: string) {
  return path.join(documentDir(documentId), "job.json");
}

export async function createDocumentJob(input: {
  sourceFileName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}): Promise<StoredDocumentJob> {
  const sourceFileType = detectSourceFileType(
    input.sourceFileName,
    input.mimeType,
  );

  if (!sourceFileType) {
    throw new StorageError("Unsupported source file type.");
  }

  const id = randomUUID();
  const dir = documentDir(id);
  await mkdir(dir, { recursive: true });

  const now = new Date().toISOString();
  const originalPath = path.join(
    dir,
    `original${sourceFileExtension(input.sourceFileName)}`,
  );

  await writeFile(originalPath, input.data);

  const job: StoredDocumentJob = {
    id,
    status: "uploaded",
    sourceFileName: input.sourceFileName,
    sourceFileType,
    mimeType: input.mimeType,
    size: input.size,
    createdAt: now,
    updatedAt: now,
    originalPath,
  };

  await saveDocumentJob(job);
  return job;
}

export async function readDocumentJob(
  documentId: string,
): Promise<StoredDocumentJob | null> {
  if (!isSafeDocumentId(documentId)) {
    return null;
  }

  try {
    const raw = await readFile(jobMetadataPath(documentId), "utf8");
    return JSON.parse(raw) as StoredDocumentJob;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function saveDocumentJob(job: StoredDocumentJob) {
  await mkdir(documentDir(job.id), { recursive: true });
  const nextJob: StoredDocumentJob = {
    ...job,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(jobMetadataPath(job.id), JSON.stringify(nextJob, null, 2));
  return nextJob;
}

export async function updateDocumentJob(
  documentId: string,
  update: Partial<Omit<StoredDocumentJob, "id" | "createdAt">>,
) {
  const existing = await readDocumentJob(documentId);

  if (!existing) {
    return null;
  }

  return saveDocumentJob({
    ...existing,
    ...update,
  });
}

export async function setDocumentJobStatus(
  documentId: string,
  status: DocumentJobStatus,
  error?: string,
) {
  return updateDocumentJob(documentId, { status, error });
}
