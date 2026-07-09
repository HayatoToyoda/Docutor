import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { summarizeSectionCounts } from "@/lib/document-model";
import { detectSourceFileType, sourceFileExtension } from "@/lib/file-types";
import type {
  DocumentJobStatus,
  DocumentJobSummary,
  StoredDocumentJob,
} from "@/lib/types";

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

/**
 * Scans `runtime/documents/*` for job.json files and reduces each to a
 * `DocumentJobSummary` for the F-1 history dashboard's `GET /api/documents`
 * endpoint. Deliberately returns summaries only (never the full
 * `reviewDocument`/`normalizedDocument` payloads) so listing many documents
 * stays cheap and the list endpoint can't be used to bulk-exfiltrate review
 * content.
 *
 * A missing storage root (nothing converted yet, or a hosted/Vercel
 * deployment with no writable filesystem) yields an empty list rather than
 * an error. A directory entry whose job.json is missing or fails to parse
 * is skipped rather than failing the whole scan.
 */
export async function listDocumentJobSummaries(): Promise<
  DocumentJobSummary[]
> {
  let entries;
  try {
    entries = await readdir(STORAGE_ROOT, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const summaries: DocumentJobSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    let job: StoredDocumentJob | null;
    try {
      job = await readDocumentJob(entry.name);
    } catch {
      // Corrupt job.json — skip this entry rather than failing the scan.
      continue;
    }

    if (!job) {
      continue;
    }

    summaries.push({
      id: job.id,
      status: job.status,
      sourceFileName: job.sourceFileName,
      sourceFileType: job.sourceFileType,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...summarizeSectionCounts(job.reviewDocument?.sections ?? []),
    });
  }

  return summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Deletes a document's entire directory (original upload, assets,
 * job.json). Returns `false` — rather than throwing — for both an invalid
 * id and a directory that doesn't exist, so the DELETE route can treat both
 * uniformly as 404 without needing to catch `StorageError` separately.
 */
export async function deleteDocumentJob(documentId: string): Promise<boolean> {
  if (!isSafeDocumentId(documentId)) {
    return false;
  }

  try {
    await rm(documentDir(documentId), { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }

  return true;
}
