"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { AppHeader } from "@/app/components/app-header";
import { BatchQueue } from "@/app/batch-queue";
import { useDocumentUpload, type Provider } from "@/app/use-document-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createDemoDocument,
  saveClientDocument,
} from "@/lib/client-document-store";
import { formatBytes } from "@/lib/format-bytes";
import { useT } from "@/lib/i18n/locale-context";
import { MAX_DIRECT_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from "@/lib/limits";
import { isSelfHostedMode } from "@/lib/mode";

export default function Home() {
  const router = useRouter();
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Bumped every time a fresh selection is made so BatchQueue (keyed on
  // this) remounts with clean per-row state instead of reusing stale rows
  // from a previous batch.
  const [batchKey, setBatchKey] = useState(0);
  const [provider, setProvider] = useState<Provider>("openai");
  const [isDragging, setIsDragging] = useState(false);
  const selfHosted = isSelfHostedMode();
  const maxUploadBytes = selfHosted ? MAX_UPLOAD_BYTES : MAX_DIRECT_UPLOAD_BYTES;
  const maxUploadMb = Math.round(maxUploadBytes / (1024 * 1024));

  const {
    isConverting,
    message,
    progress,
    convert,
    convertSingleFile,
    setMessage,
    resetStatus,
  } = useDocumentUpload();

  // Exactly one file keeps today's single-file card UI and flow untouched;
  // two or more switches to the batch queue (see BatchQueue below).
  const file = files.length === 1 ? files[0] : null;
  const isBatch = files.length > 1;

  function chooseFiles(nextFiles: FileList | null) {
    if (!nextFiles || nextFiles.length === 0) {
      return;
    }
    setFiles(Array.from(nextFiles));
    setBatchKey((key) => key + 1);
    resetStatus();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFiles(event.dataTransfer.files);
  }

  function resetSelection() {
    setFiles([]);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setMessage(t("upload.chooseFileError"));
      return;
    }

    if (file.size > maxUploadBytes) {
      setMessage(
        t(
          selfHosted
            ? "common.fileTooLargeSelfHosted"
            : "common.fileTooLargeHosted",
        ),
      );
      return;
    }

    await convert(file, provider);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f6f8] text-[#1b1d22]">
      <AppHeader activeStep="upload" />

      <section className="flex flex-1 justify-center px-5 py-10 sm:py-16">
        <form className="w-full max-w-[620px]" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-[26px] font-semibold leading-tight">
              {t("upload.title")}
            </h1>
            <p className="mt-2 max-w-[590px] text-sm leading-6 text-[#6b6f7b]">
              {t("upload.description")}
            </p>
          </div>

          <input
            accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg"
            className="sr-only"
            multiple
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
              {t("upload.dropzone")}
            </span>
            <span className="mt-1 text-xs text-[#8b8f9a]">
              {t("upload.hint", { mb: maxUploadMb })}
            </span>
          </button>

          {files.length === 0 ? (
            <Button
              className="mt-3 w-full"
              onClick={() => {
                const demoDocument = createDemoDocument({
                  name: "docutor-demo.pdf",
                  type: "application/pdf",
                  size: 0,
                });
                saveClientDocument(demoDocument);
                router.push(`/review/${demoDocument.id}`);
              }}
              type="button"
              variant="outline"
            >
              {t("upload.tryDemo")}
            </Button>
          ) : null}

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
                  {t("upload.fileReady")}
                </Badge>
                <Button
                  aria-label={t("upload.removeFileAria")}
                  className="text-[#8b8f9a] hover:text-destructive"
                  onClick={resetSelection}
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
                  {t("common.conversionMode")}
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
                      {t(
                        option === "openai"
                          ? "common.providerOpenAI"
                          : "common.providerDemo",
                      )}
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
                  {isConverting ? t("upload.converting") : t("upload.convertCta")}
                </Button>
              </div>
            </Card>
          ) : null}

          {isBatch ? (
            <BatchQueue
              convertSingleFile={convertSingleFile}
              files={files}
              key={batchKey}
              maxUploadBytes={maxUploadBytes}
              onProviderChange={setProvider}
              onReset={resetSelection}
              provider={provider}
              selfHosted={selfHosted}
            />
          ) : null}

          {message && !isConverting && !isBatch ? (
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
