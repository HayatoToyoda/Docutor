import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilesystemDocumentRepository } from "@/lib/server/filesystem-repository";

let storageRoot: string;
let repository: FilesystemDocumentRepository;

beforeEach(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "docutor-fs-repo-"));
  repository = new FilesystemDocumentRepository(storageRoot);
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(storageRoot, { recursive: true, force: true });
});

describe("FilesystemDocumentRepository.create / get", () => {
  it("round-trips a created job through get()", async () => {
    const data = Buffer.from("%PDF-1.4 fake pdf bytes");
    const created = await repository.create({
      sourceFileName: "report.pdf",
      mimeType: "application/pdf",
      size: data.byteLength,
      data,
    });

    expect(created.status).toBe("uploaded");
    expect(created.sourceFileType).toBe("pdf");
    expect(created.originalPath.startsWith(storageRoot)).toBe(true);

    const fetched = await repository.get(created.id);
    // create()'s return value carries the `updatedAt` computed before the
    // internal save() call, while save() itself stamps a fresh (and thus
    // possibly a millisecond later) `updatedAt` before persisting — a
    // pre-existing quirk of createDocumentJob/saveDocumentJob carried over
    // unchanged from storage.ts, so only updatedAt is compared loosely here.
    expect(fetched).toEqual({ ...created, updatedAt: fetched?.updatedAt });
    expect(
      new Date(fetched!.updatedAt).getTime(),
    ).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime());

    const onDisk = await readFile(created.originalPath);
    expect(onDisk.equals(data)).toBe(true);
  });

  it("returns null for a document id that doesn't exist", async () => {
    await expect(repository.get(randomUUID())).resolves.toBeNull();
  });

  it("returns null for an unsafe document id rather than throwing", async () => {
    await expect(repository.get("../escape")).resolves.toBeNull();
  });
});

describe("FilesystemDocumentRepository.update", () => {
  it("merges the patch and refreshes updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const created = await repository.create({
      sourceFileName: "deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 4,
      data: Buffer.from("test"),
    });

    vi.setSystemTime(new Date("2026-01-01T00:05:00.000Z"));

    const updated = await repository.update(created.id, {
      status: "normalizing",
    });

    expect(updated?.status).toBe("normalizing");
    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated?.updatedAt).not.toBe(created.updatedAt);
    expect(updated?.updatedAt).toBe("2026-01-01T00:05:00.000Z");

    const persisted = await repository.get(created.id);
    expect(persisted).toEqual(updated);
  });

  it("returns null when the document doesn't exist", async () => {
    await expect(
      repository.update(randomUUID(), { status: "failed" }),
    ).resolves.toBeNull();
  });
});

describe("FilesystemDocumentRepository.setStatus", () => {
  it("clears statusDetail on any status transition", async () => {
    const created = await repository.create({
      sourceFileName: "deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 4,
      data: Buffer.from("test"),
    });

    await repository.save({
      ...created,
      status: "converting",
      statusDetail: "Converting pages 1-6 of 12…",
    });

    const finished = await repository.setStatus(created.id, "ready");

    expect(finished?.status).toBe("ready");
    expect(finished?.statusDetail).toBeUndefined();
    expect(finished?.error).toBeUndefined();
  });

  it("records the error message for a failed transition", async () => {
    const created = await repository.create({
      sourceFileName: "deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 4,
      data: Buffer.from("test"),
    });

    const failed = await repository.setStatus(
      created.id,
      "failed",
      "worker crashed",
    );

    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("worker crashed");
  });
});

describe("FilesystemDocumentRepository.list", () => {
  it("returns summaries sorted by updatedAt descending and skips corrupt job.json", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = await repository.create({
      sourceFileName: "first.pdf",
      mimeType: "application/pdf",
      size: 1,
      data: Buffer.from("a"),
    });

    vi.setSystemTime(new Date("2026-01-01T00:10:00.000Z"));
    const second = await repository.create({
      sourceFileName: "second.pdf",
      mimeType: "application/pdf",
      size: 1,
      data: Buffer.from("b"),
    });

    // A directory with a corrupt job.json should be skipped, not crash the
    // whole scan.
    const corruptDir = path.join(storageRoot, "corrupt-doc");
    await mkdir(corruptDir, { recursive: true });
    await writeFile(path.join(corruptDir, "job.json"), "{not valid json");

    const summaries = await repository.list();

    expect(summaries.map((summary) => summary.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(summaries.every((summary) => summary.id !== "corrupt-doc")).toBe(
      true,
    );
  });

  it("returns an empty list when the storage root doesn't exist yet", async () => {
    const emptyRepository = new FilesystemDocumentRepository(
      path.join(storageRoot, "does-not-exist"),
    );
    await expect(emptyRepository.list()).resolves.toEqual([]);
  });
});

describe("FilesystemDocumentRepository.delete", () => {
  it("removes the document directory and returns true", async () => {
    const created = await repository.create({
      sourceFileName: "report.pdf",
      mimeType: "application/pdf",
      size: 1,
      data: Buffer.from("a"),
    });

    await expect(repository.delete(created.id)).resolves.toBe(true);
    await expect(repository.get(created.id)).resolves.toBeNull();
  });

  it("returns false for a missing id", async () => {
    await expect(repository.delete(randomUUID())).resolves.toBe(false);
  });

  it("returns false for an unsafe id rather than throwing", async () => {
    await expect(repository.delete("../escape")).resolves.toBe(false);
  });
});

describe("FilesystemDocumentRepository.readAsset", () => {
  it("reads a file that lives inside the document's directory", async () => {
    const created = await repository.create({
      sourceFileName: "deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 4,
      data: Buffer.from("test"),
    });

    const assetDir = path.join(storageRoot, created.id, "normalized");
    await mkdir(assetDir, { recursive: true });
    const assetPath = path.join(assetDir, "page-1.png");
    await writeFile(assetPath, Buffer.from("fake png bytes"));

    const data = await repository.readAsset(created.id, assetPath);
    expect(data?.toString()).toBe("fake png bytes");
  });

  it("returns null for a path outside the document's directory", async () => {
    const created = await repository.create({
      sourceFileName: "deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 4,
      data: Buffer.from("test"),
    });

    const outsideDir = await mkdtemp(
      path.join(tmpdir(), "docutor-fs-repo-outside-"),
    );
    const outsidePath = path.join(outsideDir, "secret.png");
    await writeFile(outsidePath, Buffer.from("should not be readable"));

    try {
      const data = await repository.readAsset(created.id, outsidePath);
      expect(data).toBeNull();
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("returns null for a missing file inside the document's directory", async () => {
    const created = await repository.create({
      sourceFileName: "deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 4,
      data: Buffer.from("test"),
    });

    const missingPath = path.join(
      storageRoot,
      created.id,
      "normalized",
      "missing.png",
    );

    await expect(
      repository.readAsset(created.id, missingPath),
    ).resolves.toBeNull();
  });

  it("returns null for an unsafe document id", async () => {
    await expect(
      repository.readAsset("../escape", path.join(storageRoot, "x")),
    ).resolves.toBeNull();
  });
});
