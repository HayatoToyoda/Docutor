"use client";

import { useParams } from "next/navigation";
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

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
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
          <div className="text-sm text-slate-600">
            {acceptedCount} / {sections.length} accepted
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
