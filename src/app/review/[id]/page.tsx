"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AppHeader } from "@/app/components/app-header";
import type {
  DiagramSection,
  ReviewSection,
  StoredDocumentJob,
} from "@/lib/types";

type DocumentPayload = {
  document: StoredDocumentJob;
};

type SectionPatch = {
  generatedMarkdown?: string;
  generatedCode?: string;
  drawioXml?: string;
  reviewStatus?: ReviewSection["reviewStatus"];
};

function isDiagramSection(
  section: ReviewSection | null,
): section is DiagramSection {
  return section?.type === "diagram";
}

function statusTone(status: ReviewSection["reviewStatus"]) {
  if (status === "accepted") {
    return "bg-[#e6f4ec] text-[#2e9e6b]";
  }
  if (status === "rejected") {
    return "bg-[#fdf3f2] text-[#c4554d]";
  }
  if (status === "regenerating") {
    return "bg-[#fdf6e8] text-[#a46b14]";
  }
  return "bg-[#f0f1f4] text-[#6b6f7b]";
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
      if (!code.trim()) {
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
        const result = await mermaid.render(elementId, code);
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
      <button
        className="rounded-md border border-[#dcdee4] bg-white px-3 py-1.5 text-sm font-medium text-[#4a4e58] hover:border-[#4c5fd5] hover:text-[#4c5fd5]"
        onClick={() => onSave(xml)}
        type="button"
      >
        Save draw.io XML
      </button>
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

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
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

      return {
        ...current,
        reviewDocument: {
          ...current.reviewDocument,
          sections: current.reviewDocument.sections.map((section) =>
            section.id === sectionId ? { ...section, ...patch } : section,
          ),
        },
      };
    });
  }

  async function saveSection(sectionId: string, patch: SectionPatch) {
    updateLocalSection(sectionId, patch);
    setMessage("Saving section...");

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

    const response = await fetch(
      `/api/documents/${params.id}/sections/${sectionId}/regenerate?provider=mock`,
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
    <main className="flex min-h-screen flex-col bg-[#f6f6f8] text-[#1b1d22]">
      <AppHeader
        activeStep="review"
        status={message ?? `${acceptedCount} sections accepted`}
      />

      <div className="grid min-h-0 flex-1 lg:h-[calc(100vh-56px)] lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[#e5e6ea] bg-white">
          <div className="border-b border-[#f0f1f4] p-4">
            <p className="truncate text-sm font-semibold">
              {reviewDocument?.sourceFileName ?? job?.sourceFileName ?? "Document"}
            </p>
            <p className="mt-1 text-xs text-[#8b8f9a]">
              {sections.length} sections · {acceptedCount} accepted
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#f0f1f4]">
              <div
                className="h-full rounded-full bg-[#2e9e6b] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sections.map((section) => (
              <button
                className={`mb-0.5 w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  selectedSection?.id === section.id
                    ? "border-[#c7cdf1] bg-[#eef0fc]"
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
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      section.reviewStatus === "accepted"
                        ? "bg-[#2e9e6b]"
                        : section.reviewStatus === "rejected"
                          ? "bg-[#c4554d]"
                          : section.reviewStatus === "regenerating"
                            ? "bg-[#b7791f]"
                            : "bg-[#9aa0ab]"
                    }`}
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
                        <span className="rounded bg-[#eef0fc] px-2 py-1 text-[10px] font-bold tracking-[0.07em] text-[#4c5fd5]">
                          {typeLabel(selectedSection)}
                        </span>
                        <span
                          className={`rounded px-2 py-1 text-[11px] font-semibold ${statusTone(
                            selectedSection.reviewStatus,
                          )}`}
                        >
                          {statusLabel(selectedSection.reviewStatus)}
                        </span>
                      </div>
                      <h1 className="mt-2 text-xl font-semibold">
                        {selectedSection.title}
                      </h1>
                      <p className="mt-1 text-xs text-[#8b8f9a]">
                        Source: page {selectedSection.sourcePage}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-[#dcdee4] bg-white px-3 py-2 text-xs font-medium text-[#4a4e58] hover:border-[#4c5fd5]"
                        onClick={() => regenerateSection(selectedSection.id)}
                        type="button"
                      >
                        ↻ Regenerate
                      </button>
                      <button
                        className="rounded-md border border-[#efc9c5] bg-white px-3 py-2 text-xs font-medium text-[#c4554d] hover:bg-[#fdf7f6]"
                        onClick={() =>
                          saveSection(selectedSection.id, {
                            reviewStatus: "rejected",
                          })
                        }
                        type="button"
                      >
                        Reject
                      </button>
                      <button
                        className="rounded-md border border-[#2e9e6b] bg-[#2e9e6b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#27875b]"
                        onClick={() =>
                          saveSection(selectedSection.id, {
                            reviewStatus: "accepted",
                          })
                        }
                        type="button"
                      >
                        ✓ Accept
                      </button>
                    </div>
                  </div>

                  {isDiagramSection(selectedSection) ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="overflow-hidden rounded-[10px] border border-[#e5e6ea] bg-white">
                          <div className="border-b border-[#f0f1f4] px-3.5 py-2.5 text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                            ORIGINAL SOURCE — PAGE {selectedSection.sourcePage}
                          </div>
                          <div className="min-h-[330px] whitespace-pre-wrap bg-[#fafafb] p-4 text-[13px] leading-7 text-[#4a4e58]">
                            {selectedSection.originalText ||
                              "The original visual was captured from the source document. Compare its structure with the generated diagram."}
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-[10px] border border-[#e5e6ea] bg-white">
                          <div className="flex items-center justify-between border-b border-[#f0f1f4] px-3.5 py-2.5">
                            <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                              GENERATED PREVIEW
                            </span>
                            <span className="text-[11px] text-[#9aa0ab]">
                              {selectedSection.format}
                            </span>
                          </div>
                          {selectedSection.format === "mermaid" ? (
                            <MermaidPreview code={selectedSection.generatedCode} />
                          ) : (
                            <div className="p-4 text-sm text-[#6b6f7b]">
                              Open the draw.io editor below to inspect this diagram.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[10px] border border-[#e5e6ea] bg-white">
                        <div className="border-b border-[#f0f1f4] px-3.5 py-2.5 text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                          DIAGRAM SOURCE
                        </div>
                        {selectedSection.format === "mermaid" ? (
                          <textarea
                            className="block h-64 w-full resize-y border-0 bg-[#fcfcfd] p-4 font-mono text-xs leading-6 text-[#1b1d22] outline-none"
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
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[5fr_7fr]">
                      <div className="overflow-hidden rounded-[10px] border border-[#e5e6ea] bg-white">
                        <div className="border-b border-[#f0f1f4] px-3.5 py-2.5 text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                          ORIGINAL SOURCE — PAGE {selectedSection.sourcePage}
                        </div>
                        <div className="min-h-[320px] whitespace-pre-wrap bg-[#fafafb] p-4 text-[13px] leading-7 text-[#4a4e58]">
                          {selectedSection.originalText ||
                            "Original source text was not included for this section."}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[10px] border border-[#e5e6ea] bg-white">
                        <div className="flex items-center justify-between border-b border-[#f0f1f4] px-3.5 py-2">
                          <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                            GENERATED MARKDOWN
                          </span>
                          <div className="flex rounded-md bg-[#f0f1f4] p-0.5">
                            {(["preview", "edit"] as const).map((mode) => (
                              <button
                                className={`rounded-[5px] px-3 py-1 text-xs font-medium ${
                                  viewMode === mode
                                    ? "bg-white text-[#1b1d22] shadow-sm"
                                    : "text-[#6b6f7b]"
                                }`}
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                type="button"
                              >
                                {mode === "preview" ? "Preview" : "Edit"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {viewMode === "preview" ? (
                          <div className="docutor-markdown min-h-[320px] p-5">
                            <ReactMarkdown>
                              {selectedSection.generatedMarkdown}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <textarea
                            className="block h-[420px] w-full resize-y border-0 bg-[#fcfcfd] p-4 font-mono text-xs leading-6 text-[#1b1d22] outline-none"
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
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[10px] border border-[#e5e6ea] bg-white p-6 text-sm text-[#6b6f7b]">
                  No review sections are available.
                </div>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e5e6ea] bg-white px-4 py-3 sm:px-7">
            <div className="flex items-center gap-3 text-xs text-[#6b6f7b]">
              <span>
                {reviewedCount} of {sections.length} sections reviewed
              </span>
              <button
                className="font-medium text-[#4c5fd5] disabled:text-[#b4b8c0]"
                disabled={acceptedCount === 0}
                onClick={() => downloadExport("markdown")}
                type="button"
              >
                Download Markdown
              </button>
              <button
                className="font-medium text-[#4c5fd5] disabled:text-[#b4b8c0]"
                disabled={acceptedCount === 0}
                onClick={() => downloadExport("zip")}
                type="button"
              >
                Download ZIP
              </button>
            </div>
            <button
              className="rounded-lg bg-[#4c5fd5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#3f51c0] disabled:bg-[#c9ccd4]"
              disabled={sections.length === 0 || acceptedCount !== sections.length}
              onClick={() => router.push(`/complete/${params.id}`)}
              type="button"
            >
              Complete review →
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
