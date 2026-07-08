"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { stripMermaidFence } from "@/lib/diagrams/diagram-ir";

export function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reactId = useId();
  const elementId = useMemo(
    () => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [reactId],
  );

  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      const source = stripMermaidFence(code);
      if (!source) {
        setSvg("");
        setError(null);
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
        });
        const result = await mermaid.render(elementId, source);
        if (active) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (renderError) {
        if (active) {
          setSvg("");
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Mermaid rendering failed.",
          );
        }
      }
    }

    renderDiagram();
    return () => {
      active = false;
    };
  }, [code, elementId]);

  if (error) {
    return (
      <div className="rounded-md border border-[#f3d6d3] bg-[#fdf3f2] p-3 text-sm text-[#a4453d]">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-md border border-[#e5e6ea] bg-[#fafafb] p-3 text-sm text-[#8b8f9a]">
        No Mermaid diagram code.
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[330px] items-center justify-center overflow-auto bg-white p-4 [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
