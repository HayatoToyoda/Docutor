"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";

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
  const { t } = useT();
  const iframeRef = useState<HTMLIFrameElement | null>(null);
  const [iframeElement, setIframeElement] = iframeRef;
  // A dictionary key for our own status messages (so it stays correct
  // across a locale switch) or a plain string for a draw.io-reported error
  // (an external message, left untranslated like other API/embed errors).
  const [editorStatus, setEditorStatus] = useState<
    { kind: "key"; key: "drawio.ready" | "drawio.loaded" | "drawio.autosaveCaptured" | "drawio.saved" } | { kind: "error"; text: string } | null
  >(null);
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
        setEditorStatus({ kind: "key", key: "drawio.ready" });
        postLoad();
        return;
      }

      if (message.event === "load") {
        setEditorStatus({ kind: "key", key: "drawio.loaded" });
        return;
      }

      if (message.event === "autosave" && message.xml) {
        onChange(message.xml);
        setEditorStatus({ kind: "key", key: "drawio.autosaveCaptured" });
        return;
      }

      if (message.event === "save" && message.xml) {
        onChange(message.xml);
        onSave(message.xml);
        setEditorStatus({ kind: "key", key: "drawio.saved" });
        return;
      }

      if (message.error) {
        setEditorStatus({ kind: "error", text: message.error });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [consented, iframeElement, onChange, onSave, title, xml]);

  if (!consented) {
    // The consent sentence has a single {host} placeholder; splitting the
    // translated string on the (already-interpolated) hostname lets us wrap
    // just that segment in a bold span without hand-parsing markup out of
    // the dictionary value.
    const hostName = new URL(DRAWIO_EMBED_URL).hostname;
    const consentText = t("drawio.consentText", { host: hostName });
    const [consentBefore, consentAfter] = consentText.split(hostName);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#4a4e58]">
            {t("drawio.editorLabel")}
          </span>
        </div>
        <Card className="gap-3 rounded-md border border-[#dcdee4] bg-[#fafafb] p-5 text-sm text-[#4a4e58]">
          <p>
            {consentBefore}
            <span className="font-medium">{hostName}</span>
            {consentAfter}
          </p>
          <Button
            onClick={() => {
              storeConsent();
              setConsented(true);
            }}
            type="button"
          >
            {t("drawio.openEditor")}
          </Button>
        </Card>
      </div>
    );
  }

  const statusText = editorStatus
    ? editorStatus.kind === "key"
      ? t(editorStatus.key)
      : editorStatus.text
    : t("drawio.loading");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#4a4e58]">
          {t("drawio.editorLabel")}
        </span>
        <span className="text-xs text-[#8b8f9a]">{statusText}</span>
      </div>
      <iframe
        className="h-[420px] w-full rounded-md border border-[#dcdee4]"
        ref={setIframeElement}
        src={DRAWIO_IFRAME_SRC}
        title={title}
      />
      <Button onClick={() => onSave(xml)} type="button" variant="outline">
        {t("drawio.saveXml")}
      </Button>
    </div>
  );
}
