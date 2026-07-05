import { describe, expect, it } from "vitest";
import {
  diagramIRToDrawioXml,
  diagramIRToMermaid,
  stripMermaidFence,
} from "../../src/lib/diagrams/diagram-ir";
import type { DiagramIR } from "../../src/lib/types";

const diagram: DiagramIR = {
  title: "Approval flow",
  nodes: [
    { id: "start", label: "Receive request", kind: "terminator" },
    { id: "check", label: "Amount > limit?", kind: "decision" },
    { id: "approve", label: "Manager approval", kind: "process" },
  ],
  edges: [
    { id: "edge_1", from: "start", to: "check" },
    { id: "edge_2", from: "check", to: "approve", label: "Yes" },
  ],
  groups: [],
  unclearNotes: ["Approval threshold unclear."],
  confidence: 0.7,
};

describe("DiagramIR converters", () => {
  it("renders Mermaid flowchart code", () => {
    const mermaid = diagramIRToMermaid(diagram);

    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("start");
    expect(mermaid).toContain("-->|Yes|");
    expect(mermaid).toContain("Approval threshold unclear.");
  });

  it("renders draw.io XML", () => {
    const xml = diagramIRToDrawioXml(diagram);

    expect(xml).toContain("<mxfile");
    expect(xml).toContain("Approval flow");
    expect(xml).toContain("Manager approval");
    expect(xml).toContain("edge=\"1\"");
  });
});

describe("stripMermaidFence", () => {
  it("returns raw Mermaid source unchanged", () => {
    expect(stripMermaidFence("flowchart TD\n  A --> B")).toBe(
      "flowchart TD\n  A --> B",
    );
  });

  it("strips a markdown code fence with a language tag", () => {
    expect(stripMermaidFence("```mermaid\nflowchart TD\n  A --> B\n```")).toBe(
      "flowchart TD\n  A --> B",
    );
  });

  it("strips a fence even when the model appends trailing prose after it", () => {
    const code =
      "```mermaid\ngantt\n  title Plan\n```\nTODO: confirm dates from the source diagram.";
    expect(stripMermaidFence(code)).toBe("gantt\n  title Plan");
  });
});
