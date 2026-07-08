"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DEFAULT_DRAWIO_EMBED_URL = "https://embed.diagrams.net";

// Resolved once at module load: the configured embed host, its origin (used
// for both the postMessage target and the incoming-message origin check),
// and the full iframe src built from it.
const DRAWIO_EMBED_URL =
  process.env.NEXT_PUBLIC_DRAWIO_EMBED_URL || DEFAULT_DRAWIO_EMBED_URL;
const DRAWIO_EMBED_ORIGIN = new URL(DRAWIO_EMBED_URL).origin;
const DRAWIO_IFRAME_SRC = new URL(
  "/?embed=1&proto=json&spin=1&libraries=1&noExitBtn=1&saveAndExit=0",
  DRAWIO_EMBED_URL,
).toString();

// Only the public embed.diagrams.net service sends this diagram's XML
// outside the app; a configured self-hosted host keeps the data in-house,
// so the consent gate below is skipped for it.
const IS_DEFAULT_DRAWIO_HOST =
  DRAWIO_EMBED_ORIGIN === new URL(DEFAULT_DRAWIO_EMBED_URL).origin;

const CONSENT_STORAGE_KEY = "docutor:drawio-consent";

function hasStoredConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(CONSENT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storeConsent() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CONSENT_STORAGE_KEY, "1");
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing); consent
    // then just isn't remembered across sections, which is a safe fallback.
  }
}

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
  // Self-hosted embed hosts keep the data in-house, so they skip the
  // external-send consent gate entirely. The public embed.diagrams.net host
  // only needs consent once per browser session.
  const [consented, setConsented] = useState(
    () => !IS_DEFAULT_DRAWIO_HOST || hasStoredConsent(),
  );

  useEffect(() => {
    if (!consented) {
      return;
    }

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
        DRAWIO_EMBED_ORIGIN,
      );
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== DRAWIO_EMBED_ORIGIN) {
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
  }, [consented, iframeElement, onChange, onSave, title, xml]);

  if (!consented) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#4a4e58]">
            draw.io editor
          </span>
        </div>
        <Card className="gap-3 rounded-md border border-[#dcdee4] bg-[#fafafb] p-5 text-sm text-[#4a4e58]">
          <p>
            Opening the editor sends this diagram&apos;s XML to{" "}
            <span className="font-medium">
              {new URL(DRAWIO_EMBED_URL).hostname}
            </span>
            , the configured draw.io host, so it can render and let you edit
            the diagram there. Nothing else on this page is sent.
          </p>
          <Button
            onClick={() => {
              storeConsent();
              setConsented(true);
            }}
            type="button"
          >
            Open draw.io editor
          </Button>
        </Card>
      </div>
    );
  }

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
        src={DRAWIO_IFRAME_SRC}
        title={title}
      />
      <Button onClick={() => onSave(xml)} type="button" variant="outline">
        Save draw.io XML
      </Button>
    </div>
  );
}
