"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { StoredDocumentJob } from "@/lib/types";

type DocumentPayload = {
  document: StoredDocumentJob;
};

export default function CompletePage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<StoredDocumentJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      const response = await fetch(`/api/documents/${params.id}`);
      const payload = (await response.json()) as DocumentPayload;
      if (response.ok) {
        setJob(payload.document);
      } else {
        setMessage("Document could not be loaded.");
      }
    }

    loadDocument();
  }, [params.id]);

  async function downloadExport(kind: "markdown" | "zip") {
    const response = await fetch(
      `/api/documents/${params.id}/export/${kind}`,
      { method: "POST" },
    );

    if (!response.ok) {
      setMessage(`${kind.toUpperCase()} export failed.`);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = kind === "markdown" ? `${params.id}.md` : `${params.id}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`${kind.toUpperCase()} export downloaded.`);
  }

  const reviewDocument = job?.reviewDocument;
  const sections = reviewDocument?.sections ?? [];
  const acceptedCount = sections.filter(
    (section) => section.reviewStatus === "accepted",
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-500">
              Docutor
            </p>
            <h1 className="text-xl font-semibold">Complete export</h1>
          </div>
          <Link className="text-sm font-medium text-cyan-700" href={`/review/${params.id}`}>
            Back to review
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase text-cyan-700">
            {acceptedCount} / {sections.length} sections accepted
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            {reviewDocument?.title ?? "Review document"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Export includes accepted sections, related assets, draw.io files,
            and a manifest for downstream agent workflows.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("markdown")}
              type="button"
            >
              Download Markdown
            </button>
            <button
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("zip")}
              type="button"
            >
              Download ZIP
            </button>
          </div>

          {message ? (
            <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
