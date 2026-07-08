"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  createDemoDocument,
  saveClientDocument,
} from "@/lib/client-document-store";
import { isSelfHostedMode } from "@/lib/mode";
import type { DocumentJobStatus, StoredDocumentJob } from "@/lib/types";

export type Provider = "openai" | "mock";

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

function messageForStatus(status: DocumentJobStatus): string {
  switch (status) {
    case "uploaded":
      return "Uploaded. Extracting content...";
    case "normalizing":
      return "Extracting text, tables, and page images...";
    case "converting":
      return "Converting with the LLM provider...";
    case "ready":
      return "Review workspace is ready.";
    case "failed":
      return "Conversion failed.";
    default:
      return "Working...";
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
  const [isConverting, setIsConverting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function resetStatus() {
    setMessage(null);
    setProgress(0);
  }

  async function convertHosted(file: File, provider: Provider) {
    setProgress(24);
    setMessage("Uploading source document...");

    if (provider === "mock") {
      setProgress(68);
      setMessage("Preparing browser-based demo content...");
      const demoDocument = createDemoDocument(file);
      saveClientDocument(demoDocument);
      setProgress(100);
      setMessage("Review workspace is ready.");
      router.push(`/review/${demoDocument.id}`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setProgress(52);
    setMessage("Analyzing the document with OpenAI...");
    const uploadResponse = await fetch("/api/convert-direct", {
      method: "POST",
      body: formData,
    });
    const uploadPayload = await uploadResponse.json();

    if (!uploadResponse.ok) {
      throw new Error(uploadPayload.error ?? "Upload failed.");
    }

    const document = uploadPayload.document as StoredDocumentJob;
    saveClientDocument(document);

    setProgress(100);
    setMessage("Review workspace is ready.");
    router.push(`/review/${document.id}`);
  }

  async function convertSelfHosted(file: File, provider: Provider) {
    setProgress(5);
    setMessage("Uploading source document...");

    const formData = new FormData();
    formData.append("file", file);

    const createResponse = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });
    const createPayload = await createResponse.json();

    if (!createResponse.ok) {
      throw new Error(createPayload.error ?? "Upload failed.");
    }

    const job = createPayload.document as StoredDocumentJob;
    setProgress(progressForStatus(job.status));
    setMessage(messageForStatus(job.status));

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
        setMessage(messageForStatus(statusPayload.document.status));
      } catch {
        // Transient polling failure; the convert response below remains
        // the source of truth for success/failure.
      }
    }, POLL_INTERVAL_MS);

    try {
      const providerParam = provider === "mock" ? "mock" : "openai";
      const convertResponse = await fetch(
        `/api/documents/${job.id}/convert?provider=${providerParam}`,
        { method: "POST" },
      );
      const convertPayload = (await convertResponse.json()) as {
        document?: StoredDocumentJob;
        error?: string;
      };

      if (!convertResponse.ok) {
        throw new Error(
          convertPayload.error ?? "Document conversion failed.",
        );
      }

      setProgress(100);
      setMessage("Review workspace is ready.");
      router.push(`/review/${job.id}`);
    } finally {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }

  async function convert(file: File, provider: Provider) {
    setIsConverting(true);
    setProgress(0);
    setMessage(null);

    try {
      if (isSelfHostedMode()) {
        await convertSelfHosted(file, provider);
      } else {
        await convertHosted(file, provider);
      }
    } catch (error) {
      setProgress(0);
      setMessage(error instanceof Error ? error.message : "Conversion failed.");
    } finally {
      setIsConverting(false);
    }
  }

  return {
    isConverting,
    message,
    progress,
    convert,
    setMessage,
    resetStatus,
  };
}
