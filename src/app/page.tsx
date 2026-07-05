const capabilities = [
  "Upload PowerPoint, Word, and PDF documents",
  "Extract text, tables, images, and diagram candidates",
  "Review structured Markdown sections with human approval",
  "Compare original diagram captures with Mermaid or draw.io output",
];

const stages = [
  { label: "Upload", detail: "Add source business documents" },
  { label: "Convert", detail: "Normalize content and run LLM/VLM conversion" },
  { label: "Review", detail: "Edit Markdown and diagram code before approval" },
  { label: "Export", detail: "Download Markdown and related assets" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-500">
              Docutor
            </p>
            <h1 className="text-xl font-semibold">Document conversion review</h1>
          </div>
          <div className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-600">
            MVP scaffold
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-3 text-sm font-medium uppercase text-cyan-700">
            Agent-readable knowledge assets
          </p>
          <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950">
            Convert messy enterprise documents into structured Markdown with
            human-in-the-loop diagram review.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Docutor is designed for specifications, workflows, and business
            rules trapped in PowerPoint, Word, PDF, screenshots, tables, shapes,
            arrows, and flowcharts.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {capabilities.map((capability) => (
              <div
                className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm"
                key={capability}
              >
                {capability}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold">Conversion workflow</h3>
          <div className="mt-5 space-y-4">
            {stages.map((stage, index) => (
              <div className="flex gap-4" key={stage.label}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-cyan-700 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{stage.label}</p>
                  <p className="text-sm leading-6 text-slate-600">
                    {stage.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
