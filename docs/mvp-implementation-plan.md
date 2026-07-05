# Docutor MVP Implementation Plan

## Summary

Build Docutor as a real LLM/VLM document conversion app, not a mock-only demo.

Architecture:

- Frontend and web backend: Next.js, TypeScript, Tailwind.
- Document parsing/rendering: Python Worker invoked from Node for MVP.
- LLM/VLM provider: OpenAI API by default.
- Experimental local provider: Codex App Server adapter, local-only.

Team execution rule:

- Work must be delivered in small, runnable increments.
- Each increment must leave `main` in a working state.
- Each completed increment must be committed and pushed to `origin/main`.
- Progress must be tracked with Markdown checkboxes and checked off as each item is completed.

## Implementation Checklist

- [x] Scaffold Next.js app, Tailwind, lint/build scripts, and base layout.
- [x] Add domain types, local storage directories, job state, and API skeletons.
- [x] Add Python Worker scaffold with CLI contract and JSON output.
- [x] Implement PDF extraction and page rendering.
- [x] Implement DOCX native extraction plus LibreOffice PDF/page rendering.
- [x] Implement PPTX extraction plus LibreOffice PDF/slide rendering.
- [x] Add OpenAI provider, structured output schema, and conversion prompts.
- [x] Wire upload-to-real-conversion flow.
- [x] Build review screen with section list, Markdown editor/preview, accept/reject.
- [x] Add Mermaid editor and preview.
- [x] Add `DiagramIR` to Mermaid/draw.io generation.
- [x] Add diagrams.net embedded editor and XML persistence.
- [x] Add regenerate section/diagram flow.
- [x] Add Markdown and ZIP exports.
- [x] Add Codex App Server local adapter behind an env flag.
- [ ] Add fixtures, tests, browser smoke checks, and final polish.

## Key Implementation Changes

- Use Next.js for upload UI, review UI, export UI, API routes, job state, provider orchestration, and downloads.
- Add a Python Worker for document extraction and rendering.
- Python Worker responsibilities:
  - PDF text extraction and page image rendering.
  - DOCX native extraction for paragraphs, headings, tables, and embedded images.
  - DOCX to PDF rendering via LibreOffice for visual page snapshots.
  - PPTX slide XML extraction for text, shapes, tables, and embedded images.
  - PPTX to PDF rendering via LibreOffice for slide snapshots.
  - Output a `NormalizedDocument` JSON payload.
- Do not rely on passing raw DOCX/PPTX directly to the LLM. Use native extraction plus page/slide images.
- Use OpenAI Responses API with structured outputs to produce `ReviewDocument`.
- Keep `mock` mode as a fallback/dev mode only.
- Use Mermaid for code-editable simple diagrams.
- Use embedded diagrams.net/draw.io for GUI editing of complex diagrams.

## Interfaces And Data Flow

- `POST /api/documents`: upload file, detect type, persist original, create job.
- `POST /api/documents/:id/convert`: run Python Worker, then LLM/VLM conversion.
- `GET /api/documents/:id`: return current review document.
- `PATCH /api/documents/:id/sections/:sectionId`: update Markdown, diagram code, draw.io XML, and review status.
- `POST /api/documents/:id/sections/:sectionId/regenerate`: regenerate one section or diagram.
- `POST /api/documents/:id/export/markdown`: export accepted sections as Markdown.
- `POST /api/documents/:id/export/zip`: export Markdown, assets, diagram files, and manifest.

Core internal types:

- `NormalizedDocument`
- `NormalizedPage`
- `NormalizedAsset`
- `ReviewDocument`
- `ReviewSection`
- `DiagramSection`
- `DiagramIR`
- `ConversionProvider`
- `PythonWorkerResult`

## Test Plan

- Unit tests:
  - file type detection
  - Python Worker JSON contract
  - PDF/DOCX/PPTX parser outputs
  - `DiagramIR` to Mermaid
  - `DiagramIR` to draw.io XML
  - Markdown export status filtering
- Integration tests:
  - sample PDF converts to reviewable sections
  - sample DOCX preserves headings, paragraphs, tables, and page images
  - sample PPTX preserves slide text, assets, and diagram candidates
  - OpenAI provider returns schema-valid `ReviewDocument`
- UI smoke tests:
  - upload a document
  - run real conversion
  - edit Markdown
  - edit Mermaid and preview the result
  - edit draw.io diagram through GUI and save XML
  - accept sections
  - complete review
  - download Markdown and ZIP
- Required checks before each push:
  - run the relevant unit/integration checks for the changed slice
  - run `pnpm lint` once the app scaffold exists
  - run `pnpm build` before larger milestone pushes and final handoff

## Assumptions

- Default package manager is `pnpm`.
- Default backend is Next.js API routes plus Python subprocess worker.
- Python Worker can later become FastAPI plus queue if conversion jobs become long-running.
- Runtime files are stored locally in ignored directories for MVP.
- No database, authentication, or multi-user cloud storage in the first MVP.
- Default LLM provider is OpenAI API via `OPENAI_API_KEY`.
- Codex App Server is experimental and local-only.
- Every completed implementation slice is committed and pushed to `origin/main`.

## References

- [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [Codex App Server](https://developers.openai.com/codex/app-server)
- [draw.io embed mode](https://www.drawio.com/docs/reference/embed-mode/)
- [Mermaid](https://mermaid.js.org/)
