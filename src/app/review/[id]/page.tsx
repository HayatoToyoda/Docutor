"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AppHeader } from "@/app/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { stripMermaidFence } from "@/lib/diagrams/diagram-ir";
import {
  buildClientExport,
  downloadBlob,
  isClientDocumentId,
  isDemoDocumentId,
  patchClientSection,
  readClientDocument,
  saveClientDocument,
  type ClientSectionPatch as SectionPatch,
} from "@/lib/client-document-store";
import type {
  DiagramSection,
  ReviewSection,
  StoredDocumentJob,
} from "@/lib/types";

type DocumentPayload = {
  document: StoredDocumentJob;
};

function isDiagramSection(
  section: ReviewSection | null,
): section is DiagramSection {
  return section?.type === "diagram";
}

function statusTone(status: ReviewSection["reviewStatus"]) {
  if (status === "accepted") {
    return "bg-success/10 text-success";
  }
  if (status === "rejected") {
    return "bg-destructive/10 text-destructive";
  }
  if (status === "regenerating") {
    return "bg-warning/10 text-warning";
  }
  return "bg-muted text-muted-foreground";
}

function statusDotClass(status: ReviewSection["reviewStatus"]) {
  if (status === "accepted") return "bg-success";
  if (status === "rejected") return "bg-destructive";
  if (status === "regenerating") return "bg-warning";
  return "bg-[#9aa0ab]";
}

function statusLabel(status: ReviewSection["reviewStatus"]) {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "regenerating") return "Regenerating";
  return "Pending review";
}

function typeLabel(section: ReviewSection) {
  return section.type === "paragraph"
    ? "TEXT"
    : section.type.toUpperCase();
}

// Resolves a viewable URL for the original page image behind a section, if
// one is available. Prefers an inline data URL captured directly on the
// section (used by the direct/demo client flows) and otherwise falls back
// to the server pipeline's per-page image endpoint.
function resolveSourceImageUrl(
  job: StoredDocumentJob | null,
  section: ReviewSection | null,
): string | null {
  if (!job || !section) return null;

  if (section.sourceImage?.startsWith("data:")) {
    return section.sourceImage;
  }

  const page = job.normalizedDocument?.pages.find(
    (candidate) => candidate.pageNumber === section.sourcePage,
  );

  if (page?.imagePath) {
    return `/api/documents/${job.id}/pages/${section.sourcePage}/image`;
  }

  return null;
}

function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reactId = useId();
  const elementId = useMemo(
    () => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [reactId],
  );

  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      const source = stripMermaidFence(code);
      if (!source) {
        setSvg("");
        setError(null);
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
        });
        const result = await mermaid.render(elementId, source);
        if (active) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (renderError) {
        if (active) {
          setSvg("");
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Mermaid rendering failed.",
          );
        }
      }
    }

    renderDiagram();
    return () => {
      active = false;
    };
  }, [code, elementId]);

  if (error) {
    return (
      <div className="rounded-md border border-[#f3d6d3] bg-[#fdf3f2] p-3 text-sm text-[#a4453d]">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-md border border-[#e5e6ea] bg-[#fafafb] p-3 text-sm text-[#8b8f9a]">
        No Mermaid diagram code.
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[330px] items-center justify-center overflow-auto bg-white p-4 [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function DrawioEditor({
  title,
  xml,
  onChange,
  onSave,
}: {
  title: string;
  xml: string;
  onChange: (xml: string) => void;
  onSave: (xml: string) => void;
}) {
  const iframeRef = useState<HTMLIFrameElement | null>(null);
  const [iframeElement, setIframeElement] = iframeRef;
  const [editorStatus, setEditorStatus] = useState("Loading draw.io editor...");

  useEffect(() => {
    function postLoad() {
      iframeElement?.contentWindow?.postMessage(
        JSON.stringify({
          action: "load",
          xml,
          title,
          autosave: 1,
          noExitBtn: 1,
          saveAndExit: 0,
        }),
        "https://embed.diagrams.net",
      );
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://embed.diagrams.net") {
        return;
      }

      let message: {
        event?: string;
        xml?: string;
        error?: string;
      };

      try {
        message =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (message.event === "init") {
        setEditorStatus("draw.io editor ready.");
        postLoad();
        return;
      }

      if (message.event === "load") {
        setEditorStatus("draw.io diagram loaded.");
        return;
      }

      if (message.event === "autosave" && message.xml) {
        onChange(message.xml);
        setEditorStatus("draw.io changes captured.");
        return;
      }

      if (message.event === "save" && message.xml) {
        onChange(message.xml);
        onSave(message.xml);
        setEditorStatus("draw.io XML saved.");
        return;
      }

      if (message.error) {
        setEditorStatus(message.error);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeElement, onChange, onSave, title, xml]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#4a4e58]">
          draw.io editor
        </span>
        <span className="text-xs text-[#8b8f9a]">{editorStatus}</span>
      </div>
      <iframe
        className="h-[420px] w-full rounded-md border border-[#dcdee4]"
        ref={setIframeElement}
        src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&noExitBtn=1&saveAndExit=0"
        title={title}
      />
      <Button onClick={() => onSave(xml)} type="button" variant="outline">
        Save draw.io XML
      </Button>
    </div>
  );
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<StoredDocumentJob | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const reviewDocument = job?.reviewDocument;
  const sections = useMemo(
    () => reviewDocument?.sections ?? [],
    [reviewDocument],
  );
  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) ??
    sections[0] ??
    null;
  const sourceImageUrl = useMemo(
    () => resolveSourceImageUrl(job, selectedSection),
    [job, selectedSection],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (isClientDocumentId(params.id)) {
        const document = readClientDocument(params.id);
        if (!document) {
          setMessage("Document could not be loaded in this browser.");
          return;
        }
        setJob(document);
        setSelectedSectionId(
          document.reviewDocument?.sections[0]?.id ?? null,
        );
        return;
      }

      const response = await fetch(`/api/documents/${params.id}`);
      const payload = (await response.json()) as DocumentPayload;

      if (!response.ok) {
        setMessage("Document could not be loaded.");
        return;
      }

      if (!cancelled) {
        setJob(payload.document);
        setSelectedSectionId(
          payload.document.reviewDocument?.sections[0]?.id ?? null,
        );
      }
    }

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function updateLocalSection(sectionId: string, patch: SectionPatch) {
    setJob((current) => {
      if (!current?.reviewDocument) {
        return current;
      }

      const updated = patchClientSection(current, sectionId, patch);
      if (isClientDocumentId(params.id)) {
        saveClientDocument(updated);
      }
      return updated;
    });
  }

  async function saveSection(sectionId: string, patch: SectionPatch) {
    updateLocalSection(sectionId, patch);
    setMessage("Saving section...");

    if (isClientDocumentId(params.id)) {
      setMessage("Section saved in this browser.");
      return;
    }

    const response = await fetch(
      `/api/documents/${params.id}/sections/${sectionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    const payload = (await response.json()) as DocumentPayload;

    if (!response.ok) {
      setMessage("Section update failed.");
      return;
    }

    setJob(payload.document);
    setMessage("Section saved.");
  }

  async function regenerateSection(sectionId: string) {
    setMessage("Regenerating section...");
    updateLocalSection(sectionId, { reviewStatus: "regenerating" });

    // "demo-" documents never called a real provider and have no source
    // file behind them, so regeneration stays a client-side placeholder.
    if (isDemoDocumentId(params.id)) {
      const section = sections.find((item) => item.id === sectionId);
      if (!section) return;
      updateLocalSection(
        sectionId,
        section.type === "diagram"
          ? {
              generatedCode: `${section.generatedCode}\n  %% Regenerated in demo mode`,
              generatedMarkdown: `\`\`\`mermaid\n${section.generatedCode}\n  %% Regenerated in demo mode\n\`\`\``,
              reviewStatus: "pending",
            }
          : {
              generatedMarkdown: `${section.generatedMarkdown}\n\nTODO: Regenerated in demo mode for review.`,
              reviewStatus: "pending",
            },
      );
      setMessage(
        "Demo mode: placeholder regeneration only (no LLM was called).",
      );
      return;
    }

    // "direct-" documents were produced by a real LLM call and live only in
    // this browser, so regenerate them for real via the stateless direct API.
    if (isClientDocumentId(params.id)) {
      if (!reviewDocument) return;

      try {
        const response = await fetch("/api/convert-direct/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: reviewDocument.title,
            sourceFileName: reviewDocument.sourceFileName,
            sourceFileType: reviewDocument.sourceFileType,
            sections: reviewDocument.sections,
            sectionId,
          }),
        });
        const payload = (await response.json()) as {
          section?: ReviewSection;
          error?: string;
        };

        if (!response.ok || !payload.section) {
          updateLocalSection(sectionId, { reviewStatus: "pending" });
          setMessage(payload.error ?? "Section regeneration failed.");
          return;
        }

        updateLocalSection(sectionId, payload.section);
        setMessage("Section regenerated.");
      } catch {
        updateLocalSection(sectionId, { reviewStatus: "pending" });
        setMessage("Section regeneration failed.");
      }
      return;
    }

    // Server-managed documents regenerate through the configured default
    // provider (DOCUTOR_LLM_PROVIDER) rather than a hardcoded mock provider.
    const response = await fetch(
      `/api/documents/${params.id}/sections/${sectionId}/regenerate`,
      { method: "POST" },
    );
    const payload = (await response.json()) as DocumentPayload;

    if (!response.ok) {
      setMessage("Section regeneration failed.");
      return;
    }

    setJob(payload.document);
    setMessage("Section regenerated.");
  }

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

  const acceptedCount = sections.filter(
    (section) => section.reviewStatus === "accepted",
  ).length;
  const reviewedCount = sections.filter(
    (section) =>
      section.reviewStatus === "accepted" ||
      section.reviewStatus === "rejected",
  ).length;
  const progress =
    sections.length === 0 ? 0 : Math.round((reviewedCount / sections.length) * 100);

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader
        activeStep="review"
        status={message ?? `${acceptedCount} sections accepted`}
      />

      <div className="grid min-h-0 flex-1 lg:h-[calc(100vh-56px)] lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-border bg-card">
          <div className="border-b border-[#f0f1f4] p-4">
            <p className="truncate text-sm font-semibold">
              {reviewDocument?.sourceFileName ?? job?.sourceFileName ?? "Document"}
            </p>
            <p className="mt-1 text-xs text-[#8b8f9a]">
              {sections.length} sections · {acceptedCount} accepted
            </p>
            <Progress className="mt-3" value={progress} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sections.map((section) => (
              <button
                className={`mb-0.5 w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  selectedSection?.id === section.id
                    ? "border-[#c7cdf1] bg-accent"
                    : "border-transparent hover:bg-[#f3f4f8]"
                }`}
                key={section.id}
                onClick={() => {
                  setSelectedSectionId(section.id);
                  setViewMode("preview");
                }}
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold tracking-[0.06em] text-[#8b8f9a]">
                    {typeLabel(section)}
                  </span>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(
                      section.reviewStatus,
                    )}`}
                  />
                </span>
                <span className="mt-1.5 block text-[13px] font-medium leading-5">
                  {section.title}
                </span>
                <span className="mt-0.5 block text-[11px] text-[#9aa0ab]">
                  Page {section.sourcePage} · {statusLabel(section.reviewStatus)}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
            <div className="mx-auto max-w-[1120px]">
              {selectedSection ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-accent text-accent-foreground">
                          {typeLabel(selectedSection)}
                        </Badge>
                        <Badge className={statusTone(selectedSection.reviewStatus)}>
                          {statusLabel(selectedSection.reviewStatus)}
                        </Badge>
                      </div>
                      <h1 className="mt-2 text-xl font-semibold">
                        {selectedSection.title}
                      </h1>
                      <p className="mt-1 text-xs text-[#8b8f9a]">
                        Source: page {selectedSection.sourcePage}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => regenerateSection(selectedSection.id)}
                        type="button"
                        variant="outline"
                      >
                        ↻ Regenerate
                      </Button>
                      <Button
                        onClick={() =>
                          saveSection(selectedSection.id, {
                            reviewStatus: "rejected",
                          })
                        }
                        type="button"
                        variant="destructive"
                      >
                        Reject
                      </Button>
                      <Button
                        className="bg-success text-success-foreground hover:bg-success/90"
                        onClick={() =>
                          saveSection(selectedSection.id, {
                            reviewStatus: "accepted",
                          })
                        }
                        type="button"
                      >
                        ✓ Accept
                      </Button>
                    </div>
                  </div>

                  {isDiagramSection(selectedSection) ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <Card className="gap-0 rounded-[10px] py-0">
                          <div className="px-3.5 py-2.5 text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                            ORIGINAL SOURCE — PAGE {selectedSection.sourcePage}
                          </div>
                          <Separator />
                          {sourceImageUrl ? (
                            <div className="flex min-h-[330px] items-center justify-center overflow-auto bg-[#fafafb] p-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                alt={`Original source, page ${selectedSection.sourcePage}`}
                                className="max-h-[520px] w-auto max-w-full rounded border border-[#e5e6ea] object-contain"
                                src={sourceImageUrl}
                              />
                            </div>
                          ) : (
                            <div className="min-h-[330px] whitespace-pre-wrap bg-[#fafafb] p-4 text-[13px] leading-7 text-[#4a4e58]">
                              {selectedSection.originalText ||
                                "The original visual was captured from the source document. Compare its structure with the generated diagram."}
                            </div>
                          )}
                        </Card>
                        <Card className="gap-0 rounded-[10px] py-0">
                          <div className="flex items-center justify-between px-3.5 py-2.5">
                            <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                              GENERATED PREVIEW
                            </span>
                            <span className="text-[11px] text-[#9aa0ab]">
                              {selectedSection.format}
                            </span>
                          </div>
                          <Separator />
                          {selectedSection.format === "mermaid" ? (
                            <MermaidPreview code={selectedSection.generatedCode} />
                          ) : (
                            <div className="p-4 text-sm text-[#6b6f7b]">
                              Open the draw.io editor below to inspect this diagram.
                            </div>
                          )}
                        </Card>
                      </div>

                      <Card className="gap-0 rounded-[10px] py-0">
                        <div className="px-3.5 py-2.5 text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                          DIAGRAM SOURCE
                        </div>
                        <Separator />
                        {selectedSection.format === "mermaid" ? (
                          <Textarea
                            className="h-64 resize-y rounded-none border-0 bg-[#fcfcfd] p-4 font-mono text-xs leading-6 text-foreground focus-visible:ring-0"
                            onBlur={() =>
                              saveSection(selectedSection.id, {
                                generatedCode: selectedSection.generatedCode,
                              })
                            }
                            onChange={(event) =>
                              updateLocalSection(selectedSection.id, {
                                generatedCode: event.target.value,
                              })
                            }
                            value={selectedSection.generatedCode}
                          />
                        ) : null}
                        {selectedSection.drawioXml ? (
                          <div className="p-4">
                            <DrawioEditor
                              onChange={(nextXml) =>
                                updateLocalSection(selectedSection.id, {
                                  drawioXml: nextXml,
                                })
                              }
                              onSave={(nextXml) =>
                                saveSection(selectedSection.id, {
                                  drawioXml: nextXml,
                                })
                              }
                              title={selectedSection.title}
                              xml={selectedSection.drawioXml}
                            />
                          </div>
                        ) : null}
                      </Card>
                    </div>
                  ) : (
                    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[5fr_7fr]">
                      <Card className="gap-0 rounded-[10px] py-0">
                        <div className="px-3.5 py-2.5 text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                          ORIGINAL SOURCE — PAGE {selectedSection.sourcePage}
                        </div>
                        <Separator />
                        <div className="min-h-[320px] whitespace-pre-wrap bg-[#fafafb] p-4 text-[13px] leading-7 text-[#4a4e58]">
                          {selectedSection.originalText ||
                            "Original source text was not included for this section."}
                        </div>
                        {sourceImageUrl ? (
                          <>
                            <Separator />
                            <div className="flex justify-center overflow-auto bg-[#fafafb] p-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                alt={`Original source, page ${selectedSection.sourcePage}`}
                                className="max-h-[360px] w-auto max-w-full rounded border border-[#e5e6ea] object-contain"
                                src={sourceImageUrl}
                              />
                            </div>
                          </>
                        ) : null}
                      </Card>

                      <Card className="gap-0 rounded-[10px] py-0">
                        <div className="flex items-center justify-between px-3.5 py-2">
                          <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                            GENERATED MARKDOWN
                          </span>
                          <ToggleGroup
                            className="rounded-md bg-secondary p-0.5"
                            onValueChange={(values) => {
                              const next = values[0];
                              if (next) setViewMode(next as "preview" | "edit");
                            }}
                            spacing={0}
                            value={[viewMode]}
                          >
                            {(["preview", "edit"] as const).map((mode) => (
                              <ToggleGroupItem
                                className="rounded-[5px] px-3 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm"
                                key={mode}
                                value={mode}
                              >
                                {mode === "preview" ? "Preview" : "Edit"}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                        <Separator />
                        {viewMode === "preview" ? (
                          <div className="docutor-markdown min-h-[320px] p-5">
                            <ReactMarkdown>
                              {selectedSection.generatedMarkdown}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <Textarea
                            className="h-[420px] resize-y rounded-none border-0 bg-[#fcfcfd] p-4 font-mono text-xs leading-6 text-foreground focus-visible:ring-0"
                            onBlur={() =>
                              saveSection(selectedSection.id, {
                                generatedMarkdown:
                                  selectedSection.generatedMarkdown,
                              })
                            }
                            onChange={(event) =>
                              updateLocalSection(selectedSection.id, {
                                generatedMarkdown: event.target.value,
                              })
                            }
                            value={selectedSection.generatedMarkdown}
                          />
                        )}
                      </Card>
                    </div>
                  )}
                </>
              ) : (
                <Card className="rounded-[10px] p-6 text-sm text-[#6b6f7b]">
                  No review sections are available.
                </Card>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-7">
            <div className="flex items-center gap-3 text-xs text-[#6b6f7b]">
              <span>
                {reviewedCount} of {sections.length} sections reviewed
              </span>
              <Button
                disabled={acceptedCount === 0}
                onClick={() => downloadExport("markdown")}
                type="button"
                variant="link"
              >
                Download Markdown
              </Button>
              <Button
                disabled={acceptedCount === 0}
                onClick={() => downloadExport("zip")}
                type="button"
                variant="link"
              >
                Download ZIP
              </Button>
            </div>
            <Button
              disabled={sections.length === 0 || reviewedCount !== sections.length}
              onClick={() => router.push(`/complete/${params.id}`)}
              size="lg"
              type="button"
            >
              Complete review →
            </Button>
          </footer>
        </section>
      </div>
    </main>
  );
}
