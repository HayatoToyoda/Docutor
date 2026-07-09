"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Provider } from "@/app/use-document-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatBytes } from "@/lib/format-bytes";

type BatchRowStatus = "queued" | "converting" | "ready" | "failed";

type BatchRow = {
  id: string;
  file: File;
  status: BatchRowStatus;
  documentId?: string;
  error?: string;
};

type BatchQueueProps = {
  files: File[];
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  maxUploadBytes: number;
  selfHosted: boolean;
  convertSingleFile: (
    file: File,
    provider: Provider,
  ) => Promise<{ id: string }>;
  onReset: () => void;
};

function oversizeMessage(selfHosted: boolean) {
  return selfHosted
    ? "File is too large. The self-hosted limit is 25 MB."
    : "File is too large. The hosted demo limit is 4 MB.";
}

function buildInitialRows(
  files: File[],
  maxUploadBytes: number,
  selfHosted: boolean,
): BatchRow[] {
  return files.map((file) => {
    const oversized = file.size > maxUploadBytes;
    return {
      id: crypto.randomUUID(),
      file,
      status: oversized ? "failed" : "queued",
      error: oversized ? oversizeMessage(selfHosted) : undefined,
    };
  });
}

function rowDotClass(status: BatchRowStatus) {
  if (status === "ready") return "bg-success";
  if (status === "failed") return "bg-destructive";
  if (status === "converting") return "bg-warning";
  return "bg-[#9aa0ab]";
}

function rowStatusLabel(status: BatchRowStatus) {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "converting") return "Converting…";
  return "Queued";
}

/**
 * Renders when 2+ files are selected on the upload page (src/app/page.tsx).
 * Owns its own per-row conversion state and runs files through
 * `convertSingleFile` (from useDocumentUpload) sequentially, one at a time,
 * rather than navigating away on the first success like the single-file
 * flow does. The parent remounts this component (via a changing `key`)
 * whenever a fresh batch of files is chosen, which is what resets the row
 * state below.
 */
export function BatchQueue({
  files,
  provider,
  onProviderChange,
  maxUploadBytes,
  selfHosted,
  convertSingleFile,
  onReset,
}: BatchQueueProps) {
  const [rows, setRows] = useState<BatchRow[]>(() =>
    buildInitialRows(files, maxUploadBytes, selfHosted),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const mountedRef = useRef(true);

  // Setting the ref to true here (not just false in the cleanup) matters:
  // React 18 Strict Mode's dev-only mount->unmount->remount simulation runs
  // this effect's cleanup once right after the initial mount, which would
  // otherwise leave `mountedRef.current` permanently false and silently
  // drop every row update for the rest of the component's real lifetime.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function updateRow(id: string, patch: Partial<BatchRow>) {
    if (!mountedRef.current) return;
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function handleRunBatch() {
    const queuedRows = rows.filter((row) => row.status === "queued");
    if (queuedRows.length === 0) return;

    setIsRunning(true);

    // Sequential (concurrency 1) by design: a failure on one file must not
    // block the rest, and the F-4 acceptance criteria only require that
    // conversion continues after a failure, not that it's parallelized.
    for (const row of queuedRows) {
      updateRow(row.id, { status: "converting" });
      try {
        const { id } = await convertSingleFile(row.file, provider);
        updateRow(row.id, { status: "ready", documentId: id });
      } catch (error) {
        updateRow(row.id, {
          status: "failed",
          error:
            error instanceof Error ? error.message : "Conversion failed.",
        });
      }
    }

    if (mountedRef.current) {
      setIsRunning(false);
      setHasFinished(true);
    }
  }

  const total = rows.length;
  const readyCount = rows.filter((row) => row.status === "ready").length;
  const failedCount = rows.filter((row) => row.status === "failed").length;
  const queuedCount = rows.filter((row) => row.status === "queued").length;

  const summary = `${readyCount} of ${total} converted${
    failedCount > 0 ? ` · ${failedCount} failed` : ""
  }`;

  return (
    <Card className="mt-5 gap-0 rounded-[10px] py-0">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {total} file{total === 1 ? "" : "s"} selected
          </p>
          <p className="mt-0.5 text-xs text-[#8b8f9a]">{summary}</p>
        </div>
        <Button
          aria-label="Clear selected files"
          className="text-[#8b8f9a] hover:text-destructive"
          disabled={isRunning}
          onClick={onReset}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          ×
        </Button>
      </div>

      <Separator />
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-xs font-medium text-[#6b6f7b]">
          Conversion mode
        </span>
        <ToggleGroup
          className="rounded-md bg-secondary p-0.5"
          onValueChange={(values) => {
            const next = values[0];
            if (next) onProviderChange(next as Provider);
          }}
          spacing={0}
          value={[provider]}
        >
          {(["openai", "mock"] as Provider[]).map((option) => (
            <ToggleGroupItem
              className="rounded-[5px] px-3 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm"
              key={option}
              value={option}
            >
              {option === "openai" ? "OpenAI" : "Demo"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Separator />
      <div className="max-h-[360px] overflow-y-auto">
        {rows.map((row, index) => (
          <div key={row.id}>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-[10px] font-bold text-accent-foreground">
                {row.file.name.split(".").pop()?.toUpperCase() ?? "DOC"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {row.file.name}
                </p>
                <p className="mt-0.5 text-xs text-[#8b8f9a]">
                  {formatBytes(row.file.size)}
                </p>
                {row.status === "failed" && row.error ? (
                  <p
                    className="mt-0.5 truncate text-xs text-destructive"
                    title={row.error}
                  >
                    {row.error}
                  </p>
                ) : null}
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${rowDotClass(
                    row.status,
                  )}`}
                />
                {rowStatusLabel(row.status)}
              </span>
              {row.status === "ready" && row.documentId ? (
                <Link
                  className={buttonVariants({
                    className: "shrink-0",
                    size: "sm",
                    variant: "outline",
                  })}
                  href={`/review/${row.documentId}`}
                >
                  Open review
                </Link>
              ) : null}
            </div>
            {index < rows.length - 1 ? <Separator /> : null}
          </div>
        ))}
      </div>

      <Separator />
      <div className="p-4">
        {hasFinished ? (
          <>
            <Alert className="border-success/30 bg-success/5">
              <AlertDescription className="text-success">
                {readyCount} of {total} documents converted.{" "}
                <Link className="underline" href="/documents">
                  View all in Documents
                </Link>
              </AlertDescription>
            </Alert>
            <Button
              className="mt-3 w-full"
              onClick={onReset}
              type="button"
              variant="outline"
            >
              Convert more files
            </Button>
          </>
        ) : (
          <Button
            className="w-full py-3 text-sm font-semibold"
            disabled={isRunning || queuedCount === 0}
            onClick={handleRunBatch}
            size="lg"
            type="button"
          >
            {isRunning
              ? "Converting documents..."
              : `Convert ${queuedCount} document${
                  queuedCount === 1 ? "" : "s"
                } →`}
          </Button>
        )}
      </div>
    </Card>
  );
}
