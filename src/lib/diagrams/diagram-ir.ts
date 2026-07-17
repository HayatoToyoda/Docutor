import type { DiagramIR, DiagramNode } from "@/lib/types";

export function stripMermaidFence(code: string) {
  const trimmed = code.trim();
  const fenced = trimmed.match(/```(?:\w+)?\s*\n?([\s\S]*?)```/);
  return (fenced ? fenced[1] : trimmed).trim();
}

function sanitizeId(id: string) {
  const sanitized = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return sanitized || "node";
}

// Mermaid has no backslash escapes — a literal `"` inside a quoted label
// must be written as the entity `#quot;` (`\"` is a parse error in decision
// nodes and edge labels). Verified against mermaid@11.
function escapeMermaidLabel(label: string) {
  return label.replace(/"/g, "#quot;");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function mermaidNode(node: DiagramNode) {
  const id = sanitizeId(node.id);
  const label = escapeMermaidLabel(node.label);

  if (node.kind === "decision") {
    return `${id}{"${label}"}`;
  }

  if (node.kind === "terminator") {
    return `${id}(["${label}"])`;
  }

  if (node.kind === "data") {
    return `${id}[/"${label}"/]`;
  }

  return `${id}["${label}"]`;
}

export function diagramIRToMermaid(ir: DiagramIR) {
  const lines = ["flowchart TD"];

  for (const node of ir.nodes) {
    lines.push(`  ${mermaidNode(node)}`);
  }

  for (const edge of ir.edges) {
    const from = sanitizeId(edge.from);
    const to = sanitizeId(edge.to);
    // Edge labels are emitted in quoted form so a `|` inside the label
    // can't terminate the |...| block early (unquoted `-->|a | b|` is a
    // parse error; quoted `-->|"a | b"|` is valid).
    const label = edge.label ? `|"${escapeMermaidLabel(edge.label)}"|` : "";
    lines.push(`  ${from} -->${label} ${to}`);
  }

  if (ir.unclearNotes.length > 0) {
    lines.push("  %% Unclear:");
    for (const note of ir.unclearNotes) {
      lines.push(`  %% ${note}`);
    }
  }

  return lines.join("\n");
}

function nodeStyle(node: DiagramNode) {
  if (node.kind === "decision") {
    return "rhombus;whiteSpace=wrap;html=1;fillColor=#fff7ed;strokeColor=#c2410c;";
  }

  if (node.kind === "terminator") {
    return "ellipse;whiteSpace=wrap;html=1;fillColor=#ecfdf5;strokeColor=#047857;";
  }

  if (node.kind === "data") {
    return "shape=parallelogram;whiteSpace=wrap;html=1;fillColor=#eff6ff;strokeColor=#1d4ed8;";
  }

  return "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#475569;";
}

export function diagramIRToDrawioXml(ir: DiagramIR) {
  const cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
  ];

  const columns = 3;
  ir.nodes.forEach((node, index) => {
    const id = sanitizeId(node.id);
    const x = 80 + (index % columns) * 240;
    const y = 80 + Math.floor(index / columns) * 140;
    const width = node.kind === "decision" ? 140 : 180;
    const height = node.kind === "decision" ? 90 : 70;

    cells.push(
      `<mxCell id="${escapeXml(id)}" value="${escapeXml(
        node.label,
      )}" style="${nodeStyle(
        node,
      )}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`,
    );
  });

  ir.edges.forEach((edge) => {
    cells.push(
      `<mxCell id="${escapeXml(sanitizeId(edge.id))}" value="${escapeXml(
        edge.label ?? "",
      )}" style="endArrow=block;html=1;rounded=0;" edge="1" parent="1" source="${escapeXml(
        sanitizeId(edge.from),
      )}" target="${escapeXml(
        sanitizeId(edge.to),
      )}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    );
  });

  return `<mxfile host="Docutor"><diagram name="${escapeXml(
    ir.title,
  )}"><mxGraphModel dx="1000" dy="700" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850" math="0" shadow="0"><root>${cells.join(
    "",
  )}</root></mxGraphModel></diagram></mxfile>`;
}
