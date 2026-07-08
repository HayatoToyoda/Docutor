"use client";

import ReactMarkdown from "react-markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SectionPatch } from "@/lib/document-model";
import type { ReviewSection } from "@/lib/types";
import { DrawioEditor } from "./drawio-editor";
import { MermaidPreview } from "./mermaid-preview";
import {
  isDiagramSection,
  statusLabel,
  statusTone,
  typeLabel,
} from "./section-status";

export function SectionDetail({
  warnings,
  selectedSection,
  sourceImageUrl,
  viewMode,
  onViewModeChange,
  isSaving,
  onRegenerate,
  onSave,
  onUpdateLocal,
}: {
  warnings: string[];
  selectedSection: ReviewSection | null;
  sourceImageUrl: string | null;
  viewMode: "preview" | "edit";
  onViewModeChange: (mode: "preview" | "edit") => void;
  isSaving: boolean;
  onRegenerate: () => void;
  onSave: (patch: SectionPatch) => void;
  onUpdateLocal: (patch: SectionPatch) => void;
}) {
  return (
    <div className="mx-auto max-w-[1120px]">
      {warnings.length ? (
        <Alert className="mb-4 border-warning/30 bg-warning/5">
          <AlertDescription className="text-warning">
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

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
                disabled={isSaving}
                onClick={onRegenerate}
                type="button"
                variant="outline"
              >
                {isSaving ? "↻ Regenerating…" : "↻ Regenerate"}
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => onSave({ reviewStatus: "rejected" })}
                type="button"
                variant="destructive"
              >
                Reject
              </Button>
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                disabled={isSaving}
                onClick={() => onSave({ reviewStatus: "accepted" })}
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
                      onSave({ generatedCode: selectedSection.generatedCode })
                    }
                    onChange={(event) =>
                      onUpdateLocal({ generatedCode: event.target.value })
                    }
                    value={selectedSection.generatedCode}
                  />
                ) : null}
                {selectedSection.drawioXml ? (
                  <div className="p-4">
                    <DrawioEditor
                      onChange={(nextXml) =>
                        onUpdateLocal({ drawioXml: nextXml })
                      }
                      onSave={(nextXml) => onSave({ drawioXml: nextXml })}
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
                      if (next) onViewModeChange(next as "preview" | "edit");
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
                      onSave({
                        generatedMarkdown: selectedSection.generatedMarkdown,
                      })
                    }
                    onChange={(event) =>
                      onUpdateLocal({ generatedMarkdown: event.target.value })
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
  );
}
