"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT, type Locale } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";

type AppStep = "upload" | "review" | "export";

const steps: Array<{ id: AppStep; labelKey: DictionaryKey }> = [
  { id: "upload", labelKey: "header.stepUpload" },
  { id: "review", labelKey: "header.stepReview" },
  { id: "export", labelKey: "header.stepExport" },
];

// Compact EN/日本語 language toggle (F-7), visible on every screen.
function LanguageToggle() {
  const { locale, setLocale } = useT();
  return (
    <ToggleGroup
      aria-label="Language"
      className="rounded-md bg-secondary p-0.5"
      onValueChange={(values) => {
        const next = values[0];
        if (next) setLocale(next as Locale);
      }}
      spacing={0}
      value={[locale]}
    >
      <ToggleGroupItem
        className="rounded-[5px] px-2 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm"
        value="en"
      >
        EN
      </ToggleGroupItem>
      <ToggleGroupItem
        className="rounded-[5px] px-2 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm"
        value="ja"
      >
        日本語
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function AppHeader({
  activeStep,
  status,
}: {
  // Optional so pages outside the upload → review → export flow (e.g. the
  // F-1 history dashboard at /documents) can render the header without
  // highlighting a step that doesn't apply to them.
  activeStep?: AppStep;
  status?: string;
}) {
  const { t } = useT();
  return (
    <header className="h-14 shrink-0 border-b border-[#e5e6ea] bg-white">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-6 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label={t("header.homeAria")}
            className="flex shrink-0 items-center gap-2.5"
            href="/"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[#4c5fd5] text-base font-bold text-white">
              D
            </span>
            <span className="hidden text-[15px] font-semibold text-[#1b1d22] sm:inline">
              Docutor
            </span>
          </Link>
          <span className="hidden border-l border-[#e5e6ea] pl-3 text-xs text-[#8b8f9a] md:block">
            {t("header.tagline")}
          </span>
        </div>

        <nav
          aria-label={t("header.progressAria")}
          className="flex shrink-0 items-center gap-1 text-xs sm:gap-2"
        >
          {steps.map((step, index) => (
            <div className="flex items-center gap-1 sm:gap-2" key={step.id}>
              <Badge
                className={
                  activeStep === step.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-transparent text-[#9aa0ab]"
                }
              >
                {index + 1}&nbsp; {t(step.labelKey)}
              </Badge>
              {index < steps.length - 1 ? (
                <span className="text-[#c9ccd4]">→</span>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          {status ? (
            <div className="hidden min-w-0 items-center gap-2 text-xs text-[#6b6f7b] lg:flex">
              <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
              <span className="truncate">{status}</span>
            </div>
          ) : null}
          <LanguageToggle />
          <Link
            className="text-xs font-medium text-[#6b6f7b] underline-offset-4 hover:text-[#4c5fd5] hover:underline"
            href="/documents"
          >
            {t("common.documentsNav")}
          </Link>
        </div>
      </div>
    </header>
  );
}
