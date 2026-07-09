"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/app/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  deleteClientDocument,
  listClientDocuments,
  toDocumentSummary,
} from "@/lib/client-document-store";
import type { DocumentJobStatus, DocumentJobSummary } from "@/lib/types";

type DocumentOrigin = "client" | "server";

type CombinedSummary = DocumentJobSummary & { origin: DocumentOrigin };

function statusLabel(status: DocumentJobStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "converting":
      return "Converting";
    case "normalizing":
      return "Normalizing";
    case "uploaded":
      return "Uploaded";
    default:
      return status;
  }
}

function statusTone(status: DocumentJobStatus) {
  if (status === "ready") return "bg-success/10 text-success";
  if (status === "failed") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function formatUpdatedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function sortByUpdatedAtDesc(documents: CombinedSummary[]) {
  return [...documents].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export default function DocumentsPage() {
  const [clientDocuments, setClientDocuments] = useState<CombinedSummary[]>(
    [],
  );
  const [serverDocuments, setServerDocuments] = useState<CombinedSummary[]>(
    [],
  );
  const [serverReachable, setServerReachable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  // Two-click inline delete confirm (same pattern as the Accept-with-
  // unresolved-markers confirmation in section-detail.tsx): the first click
  // arms "Delete?" for one row, a second click within 3s deletes it.
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Wrapped in an async function (rather than calling setState directly
    // in the effect body) to match the loading pattern used by the review
    // and complete pages, and to keep the localStorage read out of the
    // server-rendered pass of this "use client" page.
    async function loadClientDocuments() {
      const jobs = listClientDocuments().map((job) => ({
        ...toDocumentSummary(job),
        origin: "client" as const,
      }));
      if (!cancelled) {
        setClientDocuments(jobs);
      }
    }

    async function loadServerDocuments() {
      try {
        const response = await fetch("/api/documents");
        if (!response.ok) {
          throw new Error("Failed to list server documents.");
        }
        const payload = (await response.json()) as {
          documents: DocumentJobSummary[];
        };
        if (!cancelled) {
          setServerDocuments(
            payload.documents.map((document) => ({
              ...document,
              origin: "server" as const,
            })),
          );
        }
      } catch {
        // The server API is unreachable (e.g. a hosted deployment with no
        // writable filesystem) — tolerate this and keep showing client
        // documents only.
        if (!cancelled) {
          setServerReachable(false);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    loadClientDocuments();
    loadServerDocuments();
    return () => {
      cancelled = true;
    };
  }, []);

  const documents = useMemo(
    () => sortByUpdatedAtDesc([...clientDocuments, ...serverDocuments]),
    [clientDocuments, serverDocuments],
  );

  useEffect(() => {
    if (!armedDeleteId) return;
    const timer = setTimeout(() => setArmedDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [armedDeleteId]);

  async function handleDeleteClick(document: CombinedSummary) {
    if (armedDeleteId !== document.id) {
      setArmedDeleteId(document.id);
      return;
    }

    setArmedDeleteId(null);

    if (document.origin === "client") {
      deleteClientDocument(document.id);
      setClientDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
      return;
    }

    const response = await fetch(`/api/documents/${document.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setServerDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f6f8] text-[#1b1d22]">
      <AppHeader />

      <section className="flex flex-1 justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[860px]">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight">
              Document history
            </h1>
            <p className="mt-2 max-w-[590px] text-sm leading-6 text-[#6b6f7b]">
              Every document converted in this browser, plus any converted by
              a server-hosted deployment. Reopen a review or remove a
              document you no longer need.
            </p>
            {!serverReachable && loaded ? (
              <p className="mt-2 text-xs text-[#9aa0ab]">
                Server documents are unavailable right now — showing
                documents stored in this browser only.
              </p>
            ) : null}
          </div>

          {documents.length === 0 ? (
            <Card className="mt-6 rounded-[10px] p-8 text-center">
              <p className="text-sm font-medium">No documents yet</p>
              <p className="mt-1 text-xs text-[#8b8f9a]">
                Convert your first document to see it listed here.
              </p>
              <Link
                className={buttonVariants({ className: "mt-4", size: "sm" })}
                href="/"
              >
                Convert a document
              </Link>
            </Card>
          ) : (
            <Card className="mt-6 gap-0 rounded-[10px] py-0">
              {documents.map((document, index) => (
                <div key={document.id}>
                  <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {document.sourceFileName}
                        </p>
                        <Badge className="bg-secondary text-secondary-foreground">
                          {document.origin === "client"
                            ? "This browser"
                            : "Server"}
                        </Badge>
                        <Badge className="bg-muted text-muted-foreground uppercase">
                          {document.sourceFileType}
                        </Badge>
                        <Badge className={statusTone(document.status)}>
                          {statusLabel(document.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#8b8f9a]">
                        Updated {formatUpdatedAt(document.updatedAt)} ·{" "}
                        {document.sectionCount} section
                        {document.sectionCount === 1 ? "" : "s"} ·{" "}
                        {document.acceptedCount} accepted
                        {document.pendingCount > 0
                          ? ` · ${document.pendingCount} pending`
                          : ""}
                        {document.rejectedCount > 0
                          ? ` · ${document.rejectedCount} rejected`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        className={buttonVariants({
                          size: "sm",
                          variant: "outline",
                        })}
                        href={`/review/${document.id}`}
                      >
                        Open review
                      </Link>
                      <Button
                        className={
                          armedDeleteId === document.id
                            ? "bg-warning text-warning-foreground hover:bg-warning/90"
                            : undefined
                        }
                        onClick={() => handleDeleteClick(document)}
                        size="sm"
                        type="button"
                        variant={
                          armedDeleteId === document.id
                            ? undefined
                            : "destructive"
                        }
                      >
                        {armedDeleteId === document.id ? "Delete?" : "Delete"}
                      </Button>
                    </div>
                  </div>
                  {index < documents.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
