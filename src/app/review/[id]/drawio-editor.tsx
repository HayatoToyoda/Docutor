"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function DrawioEditor({
  title,
  xml,
  onChange,
  onSave,
}: {
  title: string;
  xml: string;
  onChange: (xml: string) => void;
  onSave: (xml: string) => void;
}) {
  const iframeRef = useState<HTMLIFrameElement | null>(null);
  const [iframeElement, setIframeElement] = iframeRef;
  const [editorStatus, setEditorStatus] = useState("Loading draw.io editor...");

  useEffect(() => {
    function postLoad() {
      iframeElement?.contentWindow?.postMessage(
        JSON.stringify({
          action: "load",
          xml,
          title,
          autosave: 1,
          noExitBtn: 1,
          saveAndExit: 0,
        }),
        "https://embed.diagrams.net",
      );
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://embed.diagrams.net") {
        return;
      }

      let message: {
        event?: string;
        xml?: string;
        error?: string;
      };

      try {
        message =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (message.event === "init") {
        setEditorStatus("draw.io editor ready.");
        postLoad();
        return;
      }

      if (message.event === "load") {
        setEditorStatus("draw.io diagram loaded.");
        return;
      }

      if (message.event === "autosave" && message.xml) {
        onChange(message.xml);
        setEditorStatus("draw.io changes captured.");
        return;
      }

      if (message.event === "save" && message.xml) {
        onChange(message.xml);
        onSave(message.xml);
        setEditorStatus("draw.io XML saved.");
        return;
      }

      if (message.error) {
        setEditorStatus(message.error);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeElement, onChange, onSave, title, xml]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#4a4e58]">
          draw.io editor
        </span>
        <span className="text-xs text-[#8b8f9a]">{editorStatus}</span>
      </div>
      <iframe
        className="h-[420px] w-full rounded-md border border-[#dcdee4]"
        ref={setIframeElement}
        src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&noExitBtn=1&saveAndExit=0"
        title={title}
      />
      <Button onClick={() => onSave(xml)} type="button" variant="outline">
        Save draw.io XML
      </Button>
    </div>
  );
}
