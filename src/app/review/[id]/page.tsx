"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
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
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "regenerating") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
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
      <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        No Mermaid diagram code.
      </div>
    );
  }

  return (
    <div
      className="overflow-auto rounded border border-slate-200 bg-white p-3"
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
        <span className="text-sm font-medium text-slate-700">
          draw.io editor
        </span>
        <span className="text-xs text-slate-500">{editorStatus}</span>
      </div>
      <iframe
        className="h-[420px] w-full rounded border border-slate-300"
        ref={setIframeElement}
        src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&noExitBtn=1&saveAndExit=0"
        title={title}
      />
      <button
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-500">
              Docutor
            </p>
            <h1 className="text-xl font-semibold">
              {reviewDocument?.title ?? "Review document"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-600">
              {acceptedCount} / {sections.length} accepted
            </div>
            <button
              className="rounded bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={sections.length === 0 || acceptedCount !== sections.length}
              onClick={() => router.push(`/complete/${params.id}`)}
              type="button"
            >
              Complete
            </button>
            <button
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("markdown")}
              type="button"
            >
              Markdown
            </button>
            <button
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={acceptedCount === 0}
              onClick={() => downloadExport("zip")}
              type="button"
            >
              ZIP
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-6 lg:grid-cols-[280px_1fr_1fr]">
        <aside className="rounded border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 text-sm font-semibold text-slate-700">
            Sections
          </h2>
          <div className="mt-3 space-y-2">
            {sections.map((section) => (
              <button
                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                  selectedSection?.id === section.id
                    ? "border-cyan-700 bg-cyan-50"
                    : "border-slate-200 bg-white"
                }`}
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                type="button"
              >
                <span className="block font-medium text-slate-900">
                  {section.title}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Page {section.sourcePage} · {section.type}
                </span>
                <span
                  className={`mt-2 inline-flex rounded border px-2 py-0.5 text-xs ${statusTone(
                    section.reviewStatus,
                  )}`}
                >
                  {section.reviewStatus}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          {selectedSection ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    {selectedSection.title}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Source page {selectedSection.sourcePage}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                    onClick={() => regenerateSection(selectedSection.id)}
                    type="button"
                  >
                    Regenerate
                  </button>
                  <button
                    className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
                    onClick={() =>
                      saveSection(selectedSection.id, {
                        reviewStatus: "accepted",
                      })
                    }
                    type="button"
                  >
                    Accept
                  </button>
                  <button
                    className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700"
                    onClick={() =>
                      saveSection(selectedSection.id, {
                        reviewStatus: "rejected",
                      })
                    }
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              </div>

              <textarea
                className="mt-4 h-[520px] w-full resize-none rounded border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-900"
                onBlur={() =>
                  saveSection(selectedSection.id, {
                    generatedMarkdown: selectedSection.generatedMarkdown,
                  })
                }
                onChange={(event) =>
                  updateLocalSection(selectedSection.id, {
                    generatedMarkdown: event.target.value,
                  })
                }
                value={selectedSection.generatedMarkdown}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              No review sections are available.
            </p>
          )}
        </section>

        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {isDiagramSection(selectedSection)
                ? "Diagram preview"
                : "Markdown preview"}
            </h2>
            {message ? <p className="text-sm text-slate-500">{message}</p> : null}
          </div>
          {isDiagramSection(selectedSection) ? (
            <div className="mt-4 space-y-4">
              {selectedSection.format === "mermaid" ? (
                <>
                  <MermaidPreview code={selectedSection.generatedCode} />
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">
                      Mermaid code
                    </span>
                    <textarea
                      className="mt-2 h-64 w-full resize-none rounded border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-900"
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
                  </label>
                </>
              ) : null}
              {selectedSection.drawioXml ? (
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
              ) : null}
            </div>
          ) : (
            <div className="prose prose-slate mt-4 max-w-none text-sm">
              <ReactMarkdown>
                {selectedSection?.generatedMarkdown ?? ""}
              </ReactMarkdown>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
