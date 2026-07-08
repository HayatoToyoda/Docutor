import { z } from "zod";

const diagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z
    .enum(["process", "decision", "data", "terminator", "group"])
    .nullable(),
});

const diagramEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().nullable(),
});

const diagramGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  nodeIds: z.array(z.string()),
});

const diagramIRSchema = z.object({
  title: z.string(),
  nodes: z.array(diagramNodeSchema),
  edges: z.array(diagramEdgeSchema),
  groups: z.array(diagramGroupSchema),
  unclearNotes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// Metadata the server always determines itself — document/section ids,
// timestamps, review status, source file identity, asset paths, and diagram
// source images — is intentionally absent from this schema. Making the
// model produce it wastes tokens and invites fabrication (e.g. an invented
// createdAt or an asset path outside the document sandbox). See
// review-document-normalizer.ts for where that metadata is stamped on.
const reviewSectionBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourcePage: z.number().int().positive(),
  originalText: z.string().nullable(),
  generatedMarkdown: z.string(),
  notes: z.array(z.string()).nullable(),
});

const nonDiagramSectionSchema = reviewSectionBaseSchema.extend({
  type: z.enum([
    "heading",
    "paragraph",
    "table",
    "image",
    "requirement",
    "note",
  ]),
});

const diagramSectionSchema = reviewSectionBaseSchema.extend({
  type: z.literal("diagram"),
  format: z.enum(["mermaid", "drawio"]),
  diagramIR: diagramIRSchema.nullable(),
  generatedCode: z
    .string()
    .describe(
      "Raw Mermaid or draw.io source for this diagram. Do not wrap it in markdown code fences (no ``` lines).",
    ),
  drawioXml: z.string().nullable(),
});

export const reviewSectionSchema = z.union([
  nonDiagramSectionSchema,
  diagramSectionSchema,
]);

export const reviewDocumentSchema = z.object({
  title: z.string(),
  sections: z.array(reviewSectionSchema),
  warnings: z.array(z.string()),
});

export type ReviewDocumentOutput = z.infer<typeof reviewDocumentSchema>;
export type ReviewSectionOutput = z.infer<typeof reviewSectionSchema>;
