import type {
  DocumentJobStatus,
  DocumentJobSummary,
  StoredDocumentJob,
} from "@/lib/types";
// `FilesystemDocumentRepository` is only referenced inside
// `createDocumentRepository()` below (never at module top level), and
// filesystem-repository.ts only references this module's `StorageError`
// inside its own method bodies — so this circular import between the two
// files is safe: neither side needs the other's binding until well after
// both modules have finished loading.
import { FilesystemDocumentRepository } from "@/lib/server/filesystem-repository";

/**
 * Storage abstraction for document jobs (F-9 step 1, see
 * docs/plans/02-feature-roadmap-plan.md). Every server API route under
 * src/app/api/documents talks to documents exclusively through this
 * interface — never through a storage-driver module directly — so a future
 * hosted backend (F-9 step 2: Vercel Blob for original/asset bytes + KV or
 * Postgres for job.json-equivalent metadata) can be swapped in later
 * without touching any route.
 *
 * `originalPath` on `StoredDocumentJob`, and any asset locator reachable
 * from a job (e.g. `NormalizedPage.imagePath`, `NormalizedAsset.path`,
 * `ReviewAsset.path`), are **storage-driver-specific locators** — today
 * they are filesystem paths written by `FilesystemDocumentRepository`, but
 * a hosted driver could put a Blob URL or object key there instead.
 * Callers outside the driver should treat them as opaque strings and only
 * ever dereference them via `readAsset`.
 */
export interface DocumentRepository {
  /** Persists a newly uploaded source file and creates its job record. */
  create(input: {
    sourceFileName: string;
    mimeType: string;
    size: number;
    data: Buffer;
  }): Promise<StoredDocumentJob>;

  /** Returns the job for `id`, or `null` if it doesn't exist. */
  get(id: string): Promise<StoredDocumentJob | null>;

  /** Persists `job` as-is (aside from refreshing `updatedAt`). */
  save(job: StoredDocumentJob): Promise<StoredDocumentJob>;

  /**
   * Merges `patch` onto the existing job for `id` and persists the result.
   * Returns `null` if the job doesn't exist rather than creating one.
   */
  update(
    id: string,
    patch: Partial<Omit<StoredDocumentJob, "id" | "createdAt">>,
  ): Promise<StoredDocumentJob | null>;

  /**
   * Convenience wrapper around `update` for status transitions. Always
   * clears `statusDetail` (F-10's per-chunk progress text), since it's only
   * meaningful mid-"converting".
   */
  setStatus(
    id: string,
    status: DocumentJobStatus,
    error?: string,
  ): Promise<StoredDocumentJob | null>;

  /**
   * Lists lightweight summaries of every stored job (F-1 history
   * dashboard), sorted by `updatedAt` descending. Never returns full
   * `normalizedDocument`/`reviewDocument` payloads.
   */
  list(): Promise<DocumentJobSummary[]>;

  /** Deletes job `id` and all of its assets. Returns `false` if it didn't exist. */
  delete(id: string): Promise<boolean>;

  /**
   * Reads an asset (original upload, page image, embedded image, ...)
   * belonging to document `id`. `assetPath` is one of the driver-specific
   * locators described above (e.g. `job.originalPath`, a
   * `NormalizedPage.imagePath`, or a `ReviewAsset.path`).
   *
   * Returns `null` both when the asset is missing *and* when it resolves
   * outside document `id`'s storage scope — callers must not distinguish
   * the two cases (and should not try to), since a hosted driver may not
   * even be able to tell them apart (e.g. an unauthorized Blob URL).
   * Containment is enforced by the implementation, not by callers.
   */
  readAsset(id: string, assetPath: string): Promise<Buffer | null>;
}

/** Generic storage failure, thrown by any `DocumentRepository` implementation. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

const SUPPORTED_DRIVERS = ["filesystem"] as const;

let singleton: DocumentRepository | undefined;

/**
 * Returns the process-wide `DocumentRepository` singleton, chosen lazily
 * (on first call) by the `DOCUTOR_STORAGE_DRIVER` env var:
 *
 *   - "filesystem" (default): stores documents under `runtime/documents/`
 *     on local disk. This is what the self-hosted pipeline uses today.
 *   - "vercel-blob" (planned — F-9 step 2, NOT implemented yet): Vercel
 *     Blob for original/asset bytes plus KV/Postgres for job metadata, for
 *     hosted deployments with no writable filesystem.
 *
 * Any other value throws immediately with a clear "unsupported storage
 * driver" error rather than silently falling back to the filesystem
 * driver.
 */
export function getDocumentRepository(): DocumentRepository {
  if (!singleton) {
    singleton = createDocumentRepository();
  }
  return singleton;
}

function createDocumentRepository(): DocumentRepository {
  const driver = process.env.DOCUTOR_STORAGE_DRIVER ?? "filesystem";

  if (driver === "filesystem") {
    return new FilesystemDocumentRepository();
  }

  throw new StorageError(
    `Unsupported storage driver "${driver}". Set DOCUTOR_STORAGE_DRIVER to one of: ${SUPPORTED_DRIVERS.join(", ")} (or leave it unset for the default, "filesystem").`,
  );
}
