import { z } from "zod";

const reviewStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "regenerating",
]);

const diagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z
    .enum(["process", "decision", "data", "terminator", "group"])
    .optional(),
});

const diagramEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
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

const reviewSectionBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourcePage: z.number().int().positive(),
  originalText: z.string().optional(),
  sourceImage: z.string().optional(),
  generatedMarkdown: z.string(),
  reviewStatus: reviewStatusSchema,
  notes: z.array(z.string()).optional(),
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
  sourceImage: z.string(),
  format: z.enum(["mermaid", "drawio"]),
  diagramIR: diagramIRSchema.optional(),
  generatedCode: z.string(),
  drawioXml: z.string().optional(),
});

export const reviewDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceFileName: z.string(),
  sourceFileType: z.enum(["pdf", "docx", "pptx"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  sections: z.array(z.union([nonDiagramSectionSchema, diagramSectionSchema])),
  assets: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      mimeType: z.string(),
      title: z.string(),
      sourcePage: z.number().int().positive().optional(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type ReviewDocumentOutput = z.infer<typeof reviewDocumentSchema>;
