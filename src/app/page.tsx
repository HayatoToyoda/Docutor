"use client";

import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useRef,
  useState,
} from "react";
import { AppHeader } from "@/app/components/app-header";

type Provider = "openai" | "mock";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<Provider>("openai");
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  function chooseFile(nextFile?: File) {
    if (!nextFile) {
      return;
    }
    setFile(nextFile);
    setMessage(null);
    setProgress(0);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setMessage("Choose a PDF, DOCX, or PPTX file.");
      return;
    }

    setIsConverting(true);
    setProgress(24);
    setMessage("Uploading source document...");

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
      setProgress(68);
      setMessage("Extracting text, tables, and diagrams...");

      const convertResponse = await fetch(
        `/api/documents/${documentId}/convert?provider=${provider}`,
        { method: "POST" },
      );
      const convertPayload = await convertResponse.json();

      if (!convertResponse.ok) {
        throw new Error(convertPayload.error ?? "Conversion failed.");
      }

      setProgress(100);
      setMessage("Review workspace is ready.");
      router.push(`/review/${documentId}`);
    } catch (error) {
      setProgress(0);
      setMessage(error instanceof Error ? error.message : "Conversion failed.");
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f6f8] text-[#1b1d22]">
      <AppHeader activeStep="upload" />

      <section className="flex flex-1 justify-center px-5 py-10 sm:py-16">
        <form className="w-full max-w-[620px]" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-[26px] font-semibold leading-tight">
              Convert a document
            </h1>
            <p className="mt-2 max-w-[590px] text-sm leading-6 text-[#6b6f7b]">
              Upload a PowerPoint, Word, or PDF file. Docutor extracts text,
              tables, and diagrams, then converts them into structured Markdown
              you can review section by section.
            </p>
          </div>

          <input
            accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="sr-only"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />

          <button
            className={`mt-6 flex w-full flex-col items-center rounded-xl border-[1.5px] border-dashed bg-white px-6 py-9 text-center transition ${
              isDragging
                ? "border-[#4c5fd5] bg-[#fbfbfe]"
                : "border-[#d3d5dc] hover:border-[#4c5fd5]"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            type="button"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#eef0fc] text-xl font-semibold text-[#4c5fd5]">
              ↑
            </span>
            <span className="mt-3 text-sm font-medium">
              Drop a file here, or click to browse
            </span>
            <span className="mt-1 text-xs text-[#8b8f9a]">
              .pptx · .docx · .pdf — max 50 MB
            </span>
          </button>

          {file ? (
            <div className="mt-5 overflow-hidden rounded-[10px] border border-[#e5e6ea] bg-white">
              <div className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef0fc] text-[10px] font-bold text-[#4c5fd5]">
                  {file.name.split(".").pop()?.toUpperCase() ?? "DOC"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="mt-0.5 text-xs text-[#8b8f9a]">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#2e9e6b]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e6f4ec]">
                    ✓
                  </span>
                  Ready
                </span>
                <button
                  aria-label="Remove selected file"
                  className="px-1 text-lg text-[#8b8f9a] hover:text-[#c4554d]"
                  onClick={() => {
                    setFile(null);
                    setMessage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  type="button"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-[#f0f1f4] px-4 py-3">
                <span className="text-xs font-medium text-[#6b6f7b]">
                  Conversion mode
                </span>
                <div className="flex rounded-md bg-[#f0f1f4] p-0.5">
                  {(["openai", "mock"] as Provider[]).map((option) => (
                    <button
                      className={`rounded-[5px] px-3 py-1 text-xs font-medium ${
                        provider === option
                          ? "bg-white text-[#1b1d22] shadow-sm"
                          : "text-[#6b6f7b]"
                      }`}
                      key={option}
                      onClick={() => setProvider(option)}
                      type="button"
                    >
                      {option === "openai" ? "OpenAI" : "Mock"}
                    </button>
                  ))}
                </div>
              </div>

              {isConverting ? (
                <div className="border-t border-[#f0f1f4] px-4 py-4">
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-medium">{message}</span>
                    <span className="text-[#4c5fd5]">{progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eceef5]">
                    <div
                      className="h-full rounded-full bg-[#4c5fd5] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="border-t border-[#f0f1f4] p-4">
                <button
                  className="w-full rounded-lg bg-[#4c5fd5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f51c0] disabled:cursor-not-allowed disabled:bg-[#aeb5df]"
                  disabled={isConverting}
                  type="submit"
                >
                  {isConverting ? "Converting document..." : "Convert document →"}
                </button>
              </div>
            </div>
          ) : null}

          {message && !isConverting ? (
            <p
              className={`mt-4 rounded-lg border px-3 py-2.5 text-sm ${
                progress === 100
                  ? "border-[#c9e7d7] bg-[#f2faf6] text-[#247c55]"
                  : "border-[#f3d6d3] bg-[#fdf3f2] text-[#a4453d]"
              }`}
            >
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
