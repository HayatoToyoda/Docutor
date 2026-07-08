// Selects which upload pipeline the app exposes.
//
// "hosted" (the default when the env var is unset) sends the file straight
// to the configured LLM provider via POST /api/convert-direct. It has no
// system dependencies beyond Node, so it works on serverless platforms like
// Vercel.
//
// "self-hosted" routes uploads through the full server pipeline
// (POST /api/documents -> POST /api/documents/[id]/convert), which shells
// out to the Python worker (LibreOffice/poppler/pdfplumber) for page-image
// extraction and normalization. It requires those system dependencies to be
// installed alongside the app.
export function isSelfHostedMode(): boolean {
  return process.env.NEXT_PUBLIC_DOCUTOR_MODE === "self-hosted";
}
