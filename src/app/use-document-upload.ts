"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  createDemoDocument,
  saveClientDocument,
} from "@/lib/client-document-store";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { isSelfHostedMode } from "@/lib/mode";
import type { DocumentJobStatus, StoredDocumentJob } from "@/lib/types";

// "anthropic" is only offered in self-hosted mode (see page.tsx /
// batch-queue.tsx) — the hosted /api/convert-direct flow stays OpenAI-only.
export type Provider = "openai" | "anthropic" | "mock";

// Shared between page.tsx and batch-queue.tsx's provider toggles.
export function providerLabelKey(provider: Provider): DictionaryKey {
  switch (provider) {
    case "openai":
      return "common.providerOpenAI";
    case "anthropic":
      return "common.providerAnthropic";
    case "mock":
      return "common.providerDemo";
  }
}

const POLL_INTERVAL_MS = 1500;

// Real progress driven by job.status, used only in self-hosted mode (which
// has a status to poll). Hosted mode has no server-side job and keeps its
// own hardcoded progress jumps below.
function progressForStatus(status: DocumentJobStatus): number {
  switch (status) {
    case "uploaded":
      return 30;
    case "normalizing":
      return 55;
    case "converting":
      return 80;
    case "ready":
      return 100;
    default:
      return 0;
  }
}

function messageKeyForStatus(status: DocumentJobStatus): DictionaryKey {
  switch (status) {
    case "uploaded":
      return "upload.statusUploaded";
    case "normalizing":
      return "upload.statusNormalizing";
    case "converting":
      return "upload.statusConverting";
    case "ready":
      return "upload.workspaceReady";
    case "failed":
      return "upload.statusFailed";
    default:
      return "upload.statusWorking";
  }
}

/**
 * Encapsulates the upload page's conversion orchestration: hosted mode
 * (browser demo or single-shot /api/convert-direct call) vs. self-hosted
 * mode (POST /api/documents then POST .../convert, with status polling for
 * real progress). Keeps page.tsx free of this branching so it stays a thin
 * composition of form + UI state.
 */
export function useDocumentUpload() {
  const router = useRouter();
  const { t } = useT();
  const [isConverting, setIsConverting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function resetStatus() {
    setMessage(null);
    setProgress(0);
  }

  async function convertHostedFile(
    file: File,
    provider: Provider,
  ): Promise<{ id: string }> {
    setProgress(24);
    setMessage(t("upload.uploadingSource"));

    if (provider === "mock") {
      setProgress(68);
      setMessage(t("upload.preparingDemo"));
      const demoDocument = createDemoDocument(file);
      saveClientDocument(demoDocument);
      setProgress(100);
      setMessage(t("upload.workspaceReady"));
      return { id: demoDocument.id };
    }

    const formData = new FormData();
    formData.append("file", file);

    setProgress(52);
    setMessage(t("upload.analyzingOpenAI"));
    const uploadResponse = await fetch("/api/convert-direct", {
      method: "POST",
      body: formData,
    });
    const uploadPayload = await uploadResponse.json();

    if (!uploadResponse.ok) {
      throw new Error(uploadPayload.error ?? t("upload.uploadFailed"));
    }

    const document = uploadPayload.document as StoredDocumentJob;
    saveClientDocument(document);

    setProgress(100);
    setMessage(t("upload.workspaceReady"));
    return { id: document.id };
  }

  async function convertSelfHostedFile(
    file: File,
    provider: Provider,
  ): Promise<{ id: string }> {
    setProgress(5);
    setMessage(t("upload.uploadingSource"));

    const formData = new FormData();
    formData.append("file", file);

    const createResponse = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });
    const createPayload = await createResponse.json();

    if (!createResponse.ok) {
      throw new Error(createPayload.error ?? t("upload.uploadFailed"));
    }

    const job = createPayload.document as StoredDocumentJob;
    setProgress(progressForStatus(job.status));
    setMessage(t(messageKeyForStatus(job.status)));

    // Poll job status for real progress while the (long-running) convert
    // request is in flight. Cleared in the `finally` below regardless of
    // whether the convert call succeeds or fails.
    pollTimerRef.current = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/documents/${job.id}`);
        if (!statusResponse.ok) return;
        const statusPayload = (await statusResponse.json()) as {
          document: StoredDocumentJob;
        };
        setProgress(progressForStatus(statusPayload.document.status));
        setMessage(t(messageKeyForStatus(statusPayload.document.status)));
      } catch {
        // Transient polling failure; the convert response below remains
        // the source of truth for success/failure.
      }
    }, POLL_INTERVAL_MS);

    try {
      // Provider's members ("openai" | "anthropic" | "mock") are already
      // valid values for the convert route's ?provider= query param.
      const convertResponse = await fetch(
        `/api/documents/${job.id}/convert?provider=${provider}`,
        { method: "POST" },
      );
      const convertPayload = (await convertResponse.json()) as {
        document?: StoredDocumentJob;
        error?: string;
      };

      if (!convertResponse.ok) {
        throw new Error(convertPayload.error ?? t("upload.statusFailed"));
      }

      setProgress(100);
      setMessage(t("upload.workspaceReady"));
      return { id: job.id };
    } finally {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }

  /**
   * Runs one file through the hosted or self-hosted conversion pipeline
   * (whichever `isSelfHostedMode()` selects) and resolves with the resulting
   * document id, without navigating anywhere. This is the shared core used
   * by both `convert` below (single-file upload flow, which navigates to
   * the review page on success) and the batch queue (src/app/batch-queue.tsx),
   * which calls this once per file, sequentially, and tracks per-row status
   * itself instead of relying on this hook's single shared
   * message/progress state.
   */
  async function convertSingleFile(
    file: File,
    provider: Provider,
  ): Promise<{ id: string }> {
    if (isSelfHostedMode()) {
      return convertSelfHostedFile(file, provider);
    }
    return convertHostedFile(file, provider);
  }

  async function convert(file: File, provider: Provider) {
    setIsConverting(true);
    setProgress(0);
    setMessage(null);

    try {
      const { id } = await convertSingleFile(file, provider);
      router.push(`/review/${id}`);
    } catch (error) {
      setProgress(0);
      setMessage(
        error instanceof Error ? error.message : t("upload.statusFailed"),
      );
    } finally {
      setIsConverting(false);
    }
  }

  return {
    isConverting,
    message,
    progress,
    convert,
    convertSingleFile,
    setMessage,
    resetStatus,
  };
}
