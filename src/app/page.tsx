"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const stages = [
  { label: "Upload", detail: "Add a PowerPoint, Word, or PDF source file" },
  { label: "Convert", detail: "Run extraction plus LLM/VLM conversion" },
  { label: "Review", detail: "Edit Markdown and approve each section" },
  { label: "Export", detail: "Complete the document and download assets" },
];

type Provider = "openai" | "mock";

export default function Home() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<Provider>("openai");
  const [isConverting, setIsConverting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setMessage("Choose a PDF, DOCX, or PPTX file.");
      return;
    }

    setIsConverting(true);
    setMessage("Uploading document...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const uploadPayload = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadPayload.error ?? "Upload failed.");
      }

      const documentId = uploadPayload.document.id as string;
      setMessage("Running conversion...");

      const convertResponse = await fetch(
        `/api/documents/${documentId}/convert?provider=${provider}`,
        { method: "POST" },
      );
      const convertPayload = await convertResponse.json();

      if (!convertResponse.ok) {
        throw new Error(convertPayload.error ?? "Conversion failed.");
      }

      router.push(`/review/${documentId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Conversion failed.");
    } finally {
      setIsConverting(false);
    }
  }

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
            Real conversion MVP
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="mb-3 text-sm font-medium uppercase text-cyan-700">
            Agent-readable knowledge assets
          </p>
          <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950">
            Convert messy enterprise documents into structured Markdown with
            human review.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Upload source documents, run extraction and LLM/VLM conversion, then
            approve every generated section before export.
          </p>

          <div className="mt-8 space-y-4">
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

        <form
          className="rounded border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <h3 className="text-base font-semibold">Upload document</h3>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-700">
              Source file
            </span>
            <input
              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="mt-2 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-700">
              Conversion provider
            </span>
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setProvider(event.target.value as Provider)}
              value={provider}
            >
              <option value="openai">OpenAI real conversion</option>
              <option value="mock">Mock fallback</option>
            </select>
          </label>

          <button
            className="mt-6 w-full rounded bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isConverting}
            type="submit"
          >
            {isConverting ? "Converting..." : "Convert document"}
          </button>

          {message ? (
            <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
