import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type AppStep = "upload" | "review" | "export";

const steps: Array<{ id: AppStep; label: string }> = [
  { id: "upload", label: "Upload" },
  { id: "review", label: "Review" },
  { id: "export", label: "Export" },
];

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
  return (
    <header className="h-14 shrink-0 border-b border-[#e5e6ea] bg-white">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-6 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="Docutor home"
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
            Documents → agent-readable Markdown
          </span>
        </div>

        <nav
          aria-label="Document conversion progress"
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
                {index + 1}&nbsp; {step.label}
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
          <Link
            className="text-xs font-medium text-[#6b6f7b] underline-offset-4 hover:text-[#4c5fd5] hover:underline"
            href="/documents"
          >
            Documents
          </Link>
        </div>
      </div>
    </header>
  );
}
