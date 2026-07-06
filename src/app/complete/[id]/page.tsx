"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/app/components/app-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  buildClientExport,
  downloadBlob,
  isClientDocumentId,
  readClientDocument,
} from "@/lib/client-document-store";
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
      if (isClientDocumentId(params.id)) {
        const document = readClientDocument(params.id);
        if (document) {
          setJob(document);
        } else {
          setMessage("Document could not be loaded in this browser.");
        }
        return;
      }

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
    if (job && isClientDocumentId(params.id)) {
      try {
        const result = await buildClientExport(job, kind);
        downloadBlob(result.blob, result.fileName);
        setMessage(`${kind.toUpperCase()} export downloaded.`);
      } catch {
        setMessage(`${kind.toUpperCase()} export failed.`);
      }
      return;
    }

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
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader activeStep="export" status={message ?? "Ready to export"} />

      <section className="flex flex-1 justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[760px]">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-2xl font-semibold text-success">
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
              <Card className="rounded-[10px] px-4 py-3.5" key={stat.label}>
                <p className="text-[22px] font-semibold">{stat.value}</p>
                <p className="mt-0.5 text-[11px] text-[#8b8f9a]">
                  {stat.label}
                </p>
              </Card>
            ))}
          </div>

          {attentionCount > 0 ? (
            <Alert className="mt-4 border-warning/30 bg-warning/5">
              <AlertDescription className="text-warning">
                The export contains <strong>{attentionCount} TODO / Unclear markers</strong>.
                Docutor keeps ambiguous source details visible instead of filling
                them silently.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="mt-5 gap-0 rounded-[10px] py-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                  EXPORT PACKAGE
                </p>
                <p className="mt-1 text-xs text-[#9aa0ab]">
                  Reviewed content bundled for downstream agent workflows
                </p>
              </div>
              <Badge className="bg-success/10 text-success">
                Ready for agents
              </Badge>
            </div>
            <Separator />

            {exportFiles.map((file, index) => (
              <div key={file.name}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
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
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-[11px] text-success">
                    ✓
                  </span>
                </div>
                {index < exportFiles.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </Card>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1 py-3 text-sm font-semibold"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("markdown")}
              size="lg"
              type="button"
            >
              ↓ Download Markdown
            </Button>
            <Button
              className="flex-1 py-3 text-sm font-semibold"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("zip")}
              size="lg"
              type="button"
              variant="outline"
            >
              ↓ Download ZIP package
            </Button>
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
