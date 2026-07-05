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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
      setMessage("Choose a PDF, DOCX, PPTX, PNG, or JPG file.");
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
              Upload a PowerPoint, Word, PDF, or image file. Docutor extracts
              text, tables, and diagrams, then converts them into structured
              Markdown you can review section by section.
            </p>
          </div>

          <input
            accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg"
            className="sr-only"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />

          <button
            className={`mt-6 flex w-full flex-col items-center rounded-xl border-[1.5px] border-dashed bg-card px-6 py-9 text-center transition ${
              isDragging
                ? "border-primary bg-[#fbfbfe]"
                : "border-[#d3d5dc] hover:border-primary"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            type="button"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-accent text-xl font-semibold text-accent-foreground">
              ↑
            </span>
            <span className="mt-3 text-sm font-medium">
              Drop a file here, or click to browse
            </span>
            <span className="mt-1 text-xs text-[#8b8f9a]">
              .pptx · .docx · .pdf · .png · .jpg — max 50 MB
            </span>
          </button>

          {file ? (
            <Card className="mt-5 gap-0 rounded-[10px] py-0">
              <div className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-[10px] font-bold text-accent-foreground">
                  {file.name.split(".").pop()?.toUpperCase() ?? "DOC"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="mt-0.5 text-xs text-[#8b8f9a]">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Badge className="bg-success/10 text-success">
                  ✓ Ready
                </Badge>
                <Button
                  aria-label="Remove selected file"
                  className="text-[#8b8f9a] hover:text-destructive"
                  onClick={() => {
                    setFile(null);
                    setMessage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  ×
                </Button>
              </div>

              <Separator />
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-xs font-medium text-[#6b6f7b]">
                  Conversion mode
                </span>
                <ToggleGroup
                  className="rounded-md bg-secondary p-0.5"
                  onValueChange={(values) => {
                    const next = values[0];
                    if (next) setProvider(next as Provider);
                  }}
                  spacing={0}
                  value={[provider]}
                >
                  {(["openai", "mock"] as Provider[]).map((option) => (
                    <ToggleGroupItem
                      className="rounded-[5px] px-3 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm"
                      key={option}
                      value={option}
                    >
                      {option === "openai" ? "OpenAI" : "Mock"}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {isConverting ? (
                <>
                  <Separator />
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="font-medium">{message}</span>
                      <span className="text-primary">{progress}%</span>
                    </div>
                    <Progress className="mt-2" value={progress} />
                  </div>
                </>
              ) : null}

              <Separator />
              <div className="p-4">
                <Button
                  className="w-full py-3 text-sm font-semibold"
                  disabled={isConverting}
                  size="lg"
                  type="submit"
                >
                  {isConverting ? "Converting document..." : "Convert document →"}
                </Button>
              </div>
            </Card>
          ) : null}

          {message && !isConverting ? (
            <Alert
              className={
                progress === 100
                  ? "mt-4 border-success/30 bg-success/5"
                  : "mt-4 border-destructive/30 bg-destructive/5"
              }
              variant={progress === 100 ? "default" : "destructive"}
            >
              <AlertDescription
                className={progress === 100 ? "text-success" : undefined}
              >
                {message}
              </AlertDescription>
            </Alert>
          ) : null}
        </form>
      </section>
    </main>
  );
}
