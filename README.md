<p align="right">English | <a href="README.ja.md">日本語</a></p>

# Docutor MVP

<p align="center">
  <img src="docs/assets/docutor-image.png" alt="Docutor - From messy docs to clear knowledge" width="520">
</p>

Docutor converts messy enterprise documents into clean, agent-readable Markdown.

The target users are traditional Japanese companies with important specifications,
workflows, and business rules trapped in PowerPoint, Word, PDF, and
diagram-heavy documents.

Docutor is not intended to be a simple OCR or file conversion tool. The goal is
to transform unstructured business documents into structured knowledge assets
that both humans and AI agents can inspect, correct, and use.

## Product Demo

[![Docutor product walkthrough](docs/assets/how-docutor-works.gif)](docs/assets/how-docutor-works.mp4)

[Watch with sound and full resolution](docs/assets/how-docutor-works.mp4)

## Getting Started

### Prerequisites

- **Node.js >= 22.13** — the repo pins `22.22.0` in `.nvmrc`; run `nvm use` if you use nvm.
- **pnpm 11.7.0**, managed via Corepack (bundled with Node). Run `corepack enable` once if `pnpm` isn't resolving to the pinned version.
- An **OpenAI API key** for the default hosted mode, or if you want real conversions — the `mock` provider works without one. See [Providers](#providers) for the other options (Anthropic, codex-local).

The following are only required for **self-hosted mode** (see [Modes](#modes)); the default hosted mode needs none of them:

- **Python 3** with `pdfplumber` and `Pillow` for document extraction:

  ```bash
  pip install pdfplumber Pillow
  ```

- **Poppler utilities** (`pdftoppm`, `pdfinfo`, `pdftotext`) for PDF text and page-image extraction:

  ```bash
  brew install poppler   # macOS
  ```

- **LibreOffice** (`soffice` on your `PATH`) for rendering DOCX/PPTX pages to images:

  ```bash
  brew install --cask libreoffice   # macOS
  ```

### Setup

```bash
git clone https://github.com/EitaroY/Docutor.git
cd Docutor
nvm use              # optional, matches the Node version pinned in .nvmrc
pnpm install
cp sample.env.local .env.local
```

Open `.env.local` and set `OPENAI_API_KEY` (or leave `DOCUTOR_LLM_PROVIDER=mock` to run without one). See [Environment variables](#environment-variables) for the full reference.

```bash
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Useful scripts

- `pnpm dev` — start the Next.js dev server
- `pnpm build` — production build
- `pnpm lint` — run ESLint
- `pnpm test` — run the Vitest unit test suite (108 tests)

## Modes

Docutor runs in one of two app modes, selected with `NEXT_PUBLIC_DOCUTOR_MODE`:

| | Hosted (default) | Self-hosted |
| --- | --- | --- |
| Enable | unset, or `NEXT_PUBLIC_DOCUTOR_MODE=hosted` | `NEXT_PUBLIC_DOCUTOR_MODE=self-hosted` |
| Upload path | `POST /api/convert-direct` | `POST /api/documents` → `POST /api/documents/[id]/convert` |
| Max file size | 4 MB | 25 MB |
| System dependencies | None — plain Node, works on serverless platforms like Vercel | Python 3 + `pdfplumber`/`Pillow`, Poppler, LibreOffice (see [Prerequisites](#prerequisites)) |
| Page extraction | The file is sent straight to the LLM provider; no page images, so the review screen's "Page image" tab is disabled with an explanatory warning (except for image uploads, which are shown directly) | Full page-image extraction and normalization via the Python worker |
| Large documents | Single provider call, no chunking (upload limit keeps this manageable) | Chunked conversion — the document is split into page windows (`DOCUTOR_PAGES_PER_CHUNK`, default 6 pages) and merged back into one document, with live progress (`Converting pages 7-12 of 23…`) |
| Providers available | OpenAI only, regardless of `DOCUTOR_LLM_PROVIDER` | `openai`, `anthropic`, `mock`, `codex-local` — selectable per request (see [Providers](#providers)) |
| Storage | Browser `localStorage` only | Server-side `DocumentRepository` (`DOCUTOR_STORAGE_DRIVER`, default `filesystem` under `runtime/documents/`) |

## Providers

Document conversion and section regeneration both go through the same `ConversionProvider` interface, so a provider is a drop-in swap:

| Provider | Document conversion | Section regeneration | Required env vars | Available in |
| --- | --- | --- | --- | --- |
| `openai` | Yes | Yes | `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-5.5`) | Hosted (the only option there) and self-hosted |
| `anthropic` | Yes | Yes | `ANTHROPIC_API_KEY` (required), `ANTHROPIC_MODEL` (default `claude-sonnet-5`) | Self-hosted pipeline only |
| `mock` | Yes | Yes | none | Self-hosted pipeline (`DOCUTOR_LLM_PROVIDER=mock`), and the hosted upload screen's "Demo" toggle (runs entirely client-side, no server call) |
| `codex-local` | Yes | Yes | `DOCUTOR_ENABLE_CODEX_LOCAL=1` (required to enable it), `CODEX_MODEL` (optional), and the `codex` CLI available on `PATH` | Self-hosted pipeline only; disabled by default |

The hosted `/api/convert-direct` flow always uses the OpenAI provider directly — it's the fast, dependency-free serverless path and stays OpenAI-only by design. The self-hosted convert route accepts a `?provider=` query parameter to pick a provider per request, falling back to `DOCUTOR_LLM_PROVIDER` when omitted.

## Environment variables

All variables live in `sample.env.local`; copy it to `.env.local` and fill in what you need.

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | Required for the `openai` provider (used by hosted mode and, optionally, self-hosted mode) | *(empty — required to use OpenAI)* |
| `OPENAI_MODEL` | Model used by the OpenAI provider | `gpt-5.5` |
| `ANTHROPIC_API_KEY` | Required for the `anthropic` provider (self-hosted pipeline only) | *(empty — required to use Anthropic)* |
| `ANTHROPIC_MODEL` | Model used by the Anthropic provider | `claude-sonnet-5` |
| `DOCUTOR_LLM_PROVIDER` | Default provider for the self-hosted pipeline: `openai`, `anthropic`, `mock`, or `codex-local` (overridable per request via `?provider=`) | `openai` |
| `DOCUTOR_PYTHON_BIN` | Python 3 executable used to run the extraction worker (self-hosted only) | `python3` |
| `DOCUTOR_ENABLE_CODEX_LOCAL` | Set to `1` to enable the `codex-local` provider | `0` (disabled) |
| `CODEX_MODEL` | Model id passed to `codex app-server` when using `codex-local` | *(empty — optional)* |
| `DOCUTOR_PAGES_PER_CHUNK` | Self-hosted only: pages per `provider.convert()` window when splitting large documents (F-10) | `6` (matches the 6-page-image cap per provider call) |
| `NEXT_PUBLIC_DOCUTOR_MODE` | Selects `hosted` or `self-hosted` app mode (see [Modes](#modes)) | `hosted` |
| `NEXT_PUBLIC_DRAWIO_EMBED_URL` | draw.io embed host used by the diagram editor; point at a self-hosted draw.io instance to keep diagram XML in-house (also skips the external-send consent prompt shown for the public host) | `https://embed.diagrams.net` |
| `DOCUTOR_STORAGE_DRIVER` | Storage backend for server-side document jobs (originals, extracted assets, job metadata). Only `filesystem` is implemented today; `vercel-blob` is planned but any non-`filesystem` value currently fails fast with an "unsupported storage driver" error | `filesystem` |
| `DOCUTOR_STORAGE_ROOT` | Self-hosted `filesystem` driver only: directory where document jobs are stored. Not in `sample.env.local` since the default is almost always correct; set it to relocate storage off the app's working directory | `runtime/documents` (relative to the process's working directory) |

## Core Product Flow

1. Upload a PowerPoint, Word, PDF, PNG, or JPG file — either a single file, or several at once through the batch queue, which converts them one at a time and shows queued/converting/ready/failed status per file (oversized files are flagged immediately without being sent).
2. The document is extracted and normalized: text, page images, tables, and diagram candidates in self-hosted mode; sent directly to the LLM provider in hosted mode.
3. Large self-hosted documents are converted in page windows and merged back into a single document, with progress shown as each window completes.
4. Review each generated section against the original: switch between a **Text** tab (the extracted page text) and a **Page image** tab (a zoomable snapshot of the source page) to check any section's provenance.
5. Regenerate a section from the Regenerate popover, optionally adding a free-text instruction ("the arrow direction is reversed", "the third table column is missing", etc.); the instruction is recorded as a `[instruction] ...` audit-trail note on the section alongside the model's own notes.
6. Compare original diagram captures with the generated Mermaid or draw.io output; edit the diagram code (or use the embedded draw.io editor) and preview the result.
7. Use the TODO/Unclear quality panel to jump straight to any section that still carries an unresolved `TODO:` or `Unclear:` marker; accepting a section that still has one prompts a confirmation instead of blocking the action.
8. Accept, reject, or regenerate each section, then complete the review.
9. Export the final Markdown, diagrams, and an agent-ready RAG bundle (see [Exports](#exports)).
10. Revisit any past conversion from the `/documents` history dashboard, which lists both browser-local and server-stored documents with status and accepted/pending/rejected counts, and supports deleting entries.

## Exports

Completing a review produces:

- **`document.md`** — accepted sections only, with YAML front-matter (`title`, `source`, `generated`, `warnings`) followed by each section's rendered body; diagram sections render from their live `generatedCode`, not a stale snapshot.
- **`manifest.json`** — export metadata: document id, source file name/type, export timestamp, accepted section ids, and the asset list.
- **`diagrams/*.mmd`** and **`diagrams/*.drawio`** — one file per diagram section, in whichever format(s) it has.
- **`agent/sections.jsonl`** — one JSON object per accepted section, shaped as an independent RAG chunk: `id`, `type`, `title`, `sourceFile`, `sourcePage`, `markdown`, `reviewStatus`, plus `notes` when present and `mermaid` / `drawioXml` for diagram sections.
- **`agent/document.json`** — document-level metadata: title, source file, converted/exported timestamps, warnings, the full section order, and accepted section ids.

The ZIP export bundles all of the above (plus an `assets/` folder for extracted images and page captures where available); the standalone Markdown export returns just `document.md`.

## MVP Scope — achieved

The original MVP scope below has shipped on `main`, along with everything built in the milestones after it (see `docs/plans/02-feature-roadmap-plan.md` for the full history). The current feature set includes:

- Single-file and multi-file batch upload with a queue UI (queued / converting / ready / failed per file, converted sequentially so one failure never blocks the rest).
- Hosted and self-hosted app modes (see [Modes](#modes)).
- Four conversion providers behind one shared interface — `openai`, `anthropic`, `mock`, `codex-local` — with two real, independently implemented LLM providers proving the abstraction isn't hard-coded to one vendor (see [Providers](#providers)).
- Chunked conversion for large self-hosted documents (`DOCUTOR_PAGES_PER_CHUNK`).
- A storage abstraction (`DocumentRepository`) with a filesystem implementation used by self-hosted mode today; a Vercel Blob/KV implementation is designed but not yet built.
- Original-page **Text** / **Page image** comparison tabs with zoom, available on every section.
- Instructed regeneration with a visible audit trail of reviewer instructions.
- A TODO/Unclear quality panel with jump-to-section navigation and an accept-with-unresolved-markers confirmation.
- A `/documents` history dashboard spanning both storage backends, with delete support.
- An agent-ready RAG export bundle (`agent/sections.jsonl` + `agent/document.json`) alongside the human-readable Markdown/YAML-front-matter export.
- A full Japanese UI: an EN/日本語 toggle backed by a 160+-key typed dictionary, persisted to `localStorage`.
- 108 Vitest unit tests covering the providers, chunked conversion, export builders, and more.

## Product Principle

Diagram conversion should be human-in-the-loop by design.

LLM/VLM output will often be imperfect, especially for arrows, grouping, layout,
branching, and ambiguous relationships. The key workflow is therefore:

- Show the original diagram image.
- Show the generated Mermaid or draw.io representation.
- Allow users to edit the generated code.
- Preview the updated diagram.
- Accept, reject, or regenerate the section.

For diagrams, Docutor prioritizes semantic correctness over pixel-perfect layout:

- Node labels
- Arrow direction
- Relationships
- Branching conditions
- Grouping
- Hierarchy
- Workflow order

## Suggested Stack

- TypeScript
- Next.js
- React
- Tailwind CSS
- shadcn/ui where useful
- Mermaid.js
- Node.js / Next.js API routes
- Python worker (`pdfplumber`, `Pillow`, shelling out to Poppler and LibreOffice) — self-hosted pipeline only

draw.io support is integrated via an embedded diagrams.net editor (`NEXT_PUBLIC_DRAWIO_EMBED_URL`), with an external-send consent prompt for the public embed host.

## Data Model

Documents are made of reviewable sections.

```ts
type SectionType =
  | "heading"
  | "paragraph"
  | "table"
  | "diagram"
  | "image"
  | "requirement"
  | "note";

type ReviewStatus = "pending" | "accepted" | "rejected" | "regenerating";

type ReviewSection = {
  id: string;
  type: SectionType;
  title: string;
  sourcePage: number;
  originalText?: string;
  sourceImage?: string;
  generatedMarkdown: string;
  reviewStatus: ReviewStatus;
};

type DiagramSection = ReviewSection & {
  type: "diagram";
  sourceImage: string;
  format: "mermaid" | "drawio";
  generatedCode: string;
};
```

## Conversion Rules

When converting documents:

- Preserve the original meaning.
- Do not invent missing rules.
- Do not silently fill gaps.
- Mark unclear content as `TODO:` or `Unclear:`.
- Structure content for AI agents.
- Separate business rules, requirements, constraints, exceptions, and workflows.
- Convert tables into Markdown tables.
- Convert simple diagrams into Mermaid.
- Use draw.io-compatible structures for diagrams that Mermaid cannot represent
  well.

## Screens

1. Upload screen (single file, or a multi-file batch queue)
2. Review screen (section list, original-page Text/Page-image tabs, quality panel, instructed regeneration popover)
3. `/documents` history dashboard
4. Complete / export screen

The UI aims to feel like a calm enterprise SaaS tool: quiet, structured, and easy
to scan during repeated review work.

## Completion Criteria — met

All of the original MVP criteria are met, and the flow now covers the full feature set above end-to-end. A user can:

1. Upload a file, or a batch of files (PDF, DOCX, PPTX, PNG, JPG).
2. Get a converted document from a real LLM provider, or the `mock` provider for a zero-setup demo.
3. Review generated sections against the original page — as text or as a zoomable page image.
4. Compare an original diagram image with the generated Mermaid or draw.io diagram.
5. Edit the diagram code and preview the update.
6. Request a regeneration with a free-text instruction and see it applied, with the instruction recorded in the section's notes.
7. Resolve TODO/Unclear markers via the quality panel before accepting a section.
8. Accept, reject, or regenerate each section.
9. Click Complete and export the Markdown, diagrams, and the agent-ready RAG bundle.
10. Return later via the `/documents` dashboard to reopen, or delete, any past conversion.
