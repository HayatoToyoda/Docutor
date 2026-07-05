"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/app/components/app-header";
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
  const sections = useMemo(
    () => reviewDocument?.sections ?? [],
    [reviewDocument],
  );
  const acceptedCount = sections.filter(
    (section) => section.reviewStatus === "accepted",
  ).length;
  const pageCount = new Set(sections.map((section) => section.sourcePage)).size;
  const diagramCount = sections.filter(
    (section) => section.type === "diagram",
  ).length;
  const attentionCount = sections.reduce((count, section) => {
    const matches = section.generatedMarkdown.match(/TODO:|Unclear:/g);
    return count + (matches?.length ?? 0);
  }, 0);

  const exportFiles = [
    {
      name: "document.md",
      detail: "Accepted sections in structured Markdown",
      type: "Markdown",
    },
    {
      name: "manifest.json",
      detail: "Document metadata and section traceability",
      type: "JSON",
    },
    {
      name: "assets/",
      detail: `${reviewDocument?.assets.length ?? 0} captured source assets`,
      type: "Folder",
    },
    ...(diagramCount > 0
      ? [
          {
            name: "diagrams/",
            detail: `${diagramCount} Mermaid or draw.io source files`,
            type: "Folder",
          },
        ]
      : []),
  ];

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f6f8] text-[#1b1d22]">
      <AppHeader activeStep="export" status={message ?? "Ready to export"} />

      <section className="flex flex-1 justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[760px]">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f4ec] text-2xl font-semibold text-[#2e9e6b]">
              ✓
            </span>
            <h1 className="mt-4 text-[26px] font-semibold leading-tight">
              Conversion complete
            </h1>
            <p className="mt-2 text-sm text-[#6b6f7b]">
              {reviewDocument?.sourceFileName ?? job?.sourceFileName ?? "Document"}{" "}
              → structured Markdown knowledge asset
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: sections.length, label: "Sections" },
              { value: acceptedCount, label: "Accepted" },
              { value: attentionCount, label: "Needs attention" },
              { value: pageCount, label: "Source pages" },
            ].map((stat) => (
              <div
                className="rounded-[10px] border border-[#e5e6ea] bg-white px-4 py-3.5"
                key={stat.label}
              >
                <p className="text-[22px] font-semibold">{stat.value}</p>
                <p className="mt-0.5 text-[11px] text-[#8b8f9a]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {attentionCount > 0 ? (
            <div className="mt-4 rounded-lg border border-[#f3e3bd] bg-[#fdf6e8] px-4 py-3 text-xs leading-5 text-[#8a5a12]">
              The export contains <strong>{attentionCount} TODO / Unclear markers</strong>.
              Docutor keeps ambiguous source details visible instead of filling
              them silently.
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-[10px] border border-[#e5e6ea] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#f0f1f4] px-4 py-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                  EXPORT PACKAGE
                </p>
                <p className="mt-1 text-xs text-[#9aa0ab]">
                  Reviewed content bundled for downstream agent workflows
                </p>
              </div>
              <span className="rounded bg-[#e6f4ec] px-2 py-1 text-[11px] font-semibold text-[#2e9e6b]">
                Ready for agents
              </span>
            </div>

            {exportFiles.map((file) => (
              <div
                className="flex items-center gap-3 border-b border-[#f6f6f8] px-4 py-3 last:border-b-0"
                key={file.name}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eef0fc] text-xs font-bold text-[#4c5fd5]">
                  {file.type === "Folder" ? "/" : "≡"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-medium">
                    {file.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#9aa0ab]">
                    {file.detail}
                  </p>
                </div>
                <span className="text-[11px] text-[#9aa0ab]">{file.type}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e6f4ec] text-[11px] text-[#2e9e6b]">
                  ✓
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="flex-1 rounded-lg bg-[#4c5fd5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f51c0] disabled:bg-[#c9ccd4]"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("markdown")}
              type="button"
            >
              ↓ Download Markdown
            </button>
            <button
              className="flex-1 rounded-lg border border-[#dcdee4] bg-white px-4 py-3 text-sm font-semibold text-[#1b1d22] hover:border-[#4c5fd5] hover:text-[#4c5fd5] disabled:text-[#b4b8c0]"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("zip")}
              type="button"
            >
              ↓ Download ZIP package
            </button>
          </div>

          <div className="mt-5 flex justify-center gap-5 text-xs">
            <Link
              className="text-[#6b6f7b] underline underline-offset-4 hover:text-[#4c5fd5]"
              href={`/review/${params.id}`}
            >
              ← Back to review
            </Link>
            <Link
              className="text-[#6b6f7b] underline underline-offset-4 hover:text-[#4c5fd5]"
              href="/"
            >
              Start a new document
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
