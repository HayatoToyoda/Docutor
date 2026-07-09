export type SourceFileType = "pdf" | "docx" | "pptx" | "image";

export type DocumentJobStatus =
  | "uploaded"
  | "normalizing"
  | "converting"
  | "ready"
  | "failed";

export type SectionType =
  | "heading"
  | "paragraph"
  | "table"
  | "diagram"
  | "image"
  | "requirement"
  | "note";

export type ReviewStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "regenerating";

export type DiagramFormat = "mermaid" | "drawio";

export type ConversionMode = "mock" | "real";

export type ConversionProviderName =
  | "openai"
  | "anthropic"
  | "codex-local"
  | "mock";

export type NormalizedAsset = {
  id: string;
  kind: "page-image" | "embedded-image" | "table" | "diagram-candidate";
  path: string;
  mimeType: string;
  sourcePage?: number;
  width?: number;
  height?: number;
};

export type NormalizedPage = {
  pageNumber: number;
  text: string;
  markdownTables: string[];
  imagePath?: string;
  assets: NormalizedAsset[];
};

export type NormalizedDocument = {
  id: string;
  sourceFileName: string;
  fileType: SourceFileType;
  createdAt: string;
  pages: NormalizedPage[];
  assets: NormalizedAsset[];
  warnings: string[];
};

export type DiagramNode = {
  id: string;
  label: string;
  kind?: "process" | "decision" | "data" | "terminator" | "group";
};

export type DiagramEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type DiagramGroup = {
  id: string;
  label: string;
  nodeIds: string[];
};

export type DiagramIR = {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
  unclearNotes: string[];
  confidence: number;
};

export type ReviewAsset = {
  id: string;
  path: string;
  mimeType: string;
  title: string;
  sourcePage?: number;
};

export type ReviewSectionBase = {
  id: string;
  title: string;
  sourcePage: number;
  originalText?: string;
  sourceImage?: string;
  generatedMarkdown: string;
  reviewStatus: ReviewStatus;
  notes?: string[];
};

export type NonDiagramSection = ReviewSectionBase & {
  type: Exclude<SectionType, "diagram">;
};

export type DiagramSection = ReviewSectionBase & {
  type: "diagram";
  sourceImage: string;
  format: DiagramFormat;
  diagramIR?: DiagramIR;
  generatedCode: string;
  drawioXml?: string;
};

export type ReviewSection = NonDiagramSection | DiagramSection;

export type ReviewDocument = {
  id: string;
  title: string;
  sourceFileName: string;
  sourceFileType: SourceFileType;
  createdAt: string;
  updatedAt: string;
  sections: ReviewSection[];
  assets: ReviewAsset[];
  warnings: string[];
};

export type StoredDocumentJob = {
  id: string;
  status: DocumentJobStatus;
  sourceFileName: string;
  sourceFileType: SourceFileType;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  originalPath: string;
  normalizedDocument?: NormalizedDocument;
  reviewDocument?: ReviewDocument;
  error?: string;
  // Single-copy data URL of the original upload for the direct flow's
  // comparison view (avoids duplicating the image onto every section).
  directSourceImage?: string;
};

// Lightweight summary of a StoredDocumentJob for the F-1 history dashboard —
// deliberately omits normalizedDocument/reviewDocument (see
// listDocumentJobSummaries) so listing many jobs stays cheap and never leaks
// full review content through the list endpoint.
export type DocumentJobSummary = {
  id: string;
  status: DocumentJobStatus;
  sourceFileName: string;
  sourceFileType: SourceFileType;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  acceptedCount: number;
  pendingCount: number;
  rejectedCount: number;
};

export type PythonWorkerResult = {
  document: NormalizedDocument;
  stderr?: string;
};

export type RegenerateSectionOptions = {
  // Optional free-text reviewer instruction (F-3) steering this
  // regeneration, e.g. "the arrow between steps 2 and 3 points the wrong
  // way".
  instruction?: string;
};

export type ConversionProvider = {
  name: ConversionProviderName;
  convert(input: NormalizedDocument): Promise<ReviewDocument>;
  regenerateSection?(
    input: NormalizedDocument,
    section: ReviewSection,
    options?: RegenerateSectionOptions,
  ): Promise<ReviewSection>;
};
