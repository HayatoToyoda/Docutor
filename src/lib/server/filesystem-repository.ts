import { randomUUID } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { summarizeSectionCounts } from "@/lib/document-model";
import { detectSourceFileType, sourceFileExtension } from "@/lib/file-types";
import {
  StorageError,
  type DocumentRepository,
} from "@/lib/server/document-repository";
import type {
  DocumentJobStatus,
  DocumentJobSummary,
  StoredDocumentJob,
} from "@/lib/types";

function defaultStorageRoot() {
  return (
    process.env.DOCUTOR_STORAGE_ROOT ??
    path.join(process.cwd(), "runtime", "documents")
  );
}

// Document ids are generated with randomUUID() or a "direct-"/"demo-" prefix
// plus a UUID. Restricting to this charset keeps documentDir() from ever
// escaping the storage root via a crafted id (e.g. "..").
const SAFE_DOCUMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isSafeDocumentId(documentId: string) {
  return SAFE_DOCUMENT_ID_PATTERN.test(documentId);
}

/**
 * The self-hosted `DocumentRepository`: stores original uploads, extracted
 * assets, and job.json metadata under `<storageRoot>/<documentId>/` on
 * local disk. This is the only storage driver implemented so far (F-9 step
 * 1) — see document-repository.ts for the planned hosted (Vercel Blob/KV)
 * driver.
 */
export class FilesystemDocumentRepository implements DocumentRepository {
  private readonly storageRoot: string;

  constructor(storageRoot: string = defaultStorageRoot()) {
    this.storageRoot = storageRoot;
  }

  documentDir(documentId: string) {
    if (!isSafeDocumentId(documentId)) {
      throw new StorageError("Invalid document id.");
    }
    return path.join(this.storageRoot, documentId);
  }

  jobMetadataPath(documentId: string) {
    return path.join(this.documentDir(documentId), "job.json");
  }

  async create(input: {
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
    const dir = this.documentDir(id);
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

    await this.save(job);
    return job;
  }

  async get(documentId: string): Promise<StoredDocumentJob | null> {
    if (!isSafeDocumentId(documentId)) {
      return null;
    }

    try {
      const raw = await readFile(this.jobMetadataPath(documentId), "utf8");
      return JSON.parse(raw) as StoredDocumentJob;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async save(job: StoredDocumentJob): Promise<StoredDocumentJob> {
    await mkdir(this.documentDir(job.id), { recursive: true });
    const nextJob: StoredDocumentJob = {
      ...job,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(
      this.jobMetadataPath(job.id),
      JSON.stringify(nextJob, null, 2),
    );
    return nextJob;
  }

  async update(
    documentId: string,
    patch: Partial<Omit<StoredDocumentJob, "id" | "createdAt">>,
  ): Promise<StoredDocumentJob | null> {
    const existing = await this.get(documentId);

    if (!existing) {
      return null;
    }

    return this.save({
      ...existing,
      ...patch,
    });
  }

  async setStatus(
    documentId: string,
    status: DocumentJobStatus,
    error?: string,
  ): Promise<StoredDocumentJob | null> {
    // Always clears statusDetail (F-10's per-chunk progress text): it's
    // only meaningful mid-"converting", so any other status transition
    // should start from a clean slate rather than showing stale chunk
    // progress.
    return this.update(documentId, { status, error, statusDetail: undefined });
  }

  /**
   * Scans `<storageRoot>/*` for job.json files and reduces each to a
   * `DocumentJobSummary` for the F-1 history dashboard's `GET
   * /api/documents` endpoint. Deliberately returns summaries only (never
   * the full `reviewDocument`/`normalizedDocument` payloads) so listing
   * many documents stays cheap and the list endpoint can't be used to bulk-
   * exfiltrate review content.
   *
   * A missing storage root (nothing converted yet, or a hosted/Vercel
   * deployment with no writable filesystem) yields an empty list rather
   * than an error. A directory entry whose job.json is missing or fails to
   * parse is skipped rather than failing the whole scan.
   */
  async list(): Promise<DocumentJobSummary[]> {
    let entries;
    try {
      entries = await readdir(this.storageRoot, { withFileTypes: true });
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
        job = await this.get(entry.name);
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
   * job.json). Returns `false` — rather than throwing — for both an
   * invalid id and a directory that doesn't exist, so the DELETE route can
   * treat both uniformly as 404 without needing to catch `StorageError`
   * separately.
   */
  async delete(documentId: string): Promise<boolean> {
    if (!isSafeDocumentId(documentId)) {
      return false;
    }

    try {
      await rm(this.documentDir(documentId), { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }

    return true;
  }

  /**
   * Reads `assetPath` (a filesystem path — see the `DocumentRepository`
   * interface doc for why callers should treat it as opaque) after
   * verifying it resolves inside document `id`'s directory. This is the
   * defense-in-depth containment check formerly inlined in the page-image
   * route: even though asset paths currently only ever come from our own
   * Python Worker output (not user input), we still verify before reading
   * from disk. Both the document directory and the asset path are resolved
   * through `realpath` (not just `path.resolve`) so a symlink inside the
   * doc dir can't be used to escape it.
   *
   * Returns `null` — never throws — for a missing file, an invalid/unsafe
   * document id, or a path that escapes the document's directory.
   */
  async readAsset(documentId: string, assetPath: string): Promise<Buffer | null> {
    let documentRoot: string;
    let resolvedAssetPath: string;
    try {
      documentRoot = await realpath(this.documentDir(documentId));
      resolvedAssetPath = await realpath(path.resolve(assetPath));
    } catch {
      return null;
    }

    const relative = path.relative(documentRoot, resolvedAssetPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return null;
    }

    try {
      return await readFile(resolvedAssetPath);
    } catch {
      return null;
    }
  }
}
