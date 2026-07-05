import { describe, expect, it } from "vitest";
import {
  diagramIRToDrawioXml,
  diagramIRToMermaid,
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
