// Flat, typed dictionary for Docutor's lightweight i18n (F-7). English is
// the source of truth: every key that exists in `en` must also exist in
// `ja`, and TypeScript enforces that (a missing `ja` key is a type error,
// not a runtime fallback).
//
// Keys are namespaced by screen ("upload.*", "review.*", "complete.*",
// "documents.*", "batch.*", "header.*", "drawio.*") with a "common.*"
// namespace for strings shared across screens.
//
// Out of scope (per the F-7 plan): API error strings returned by the server
// (rendered as-is), file names, the "Docutor" brand name, TODO:/Unclear:
// marker syntax, and exported Markdown content.

export const en = {
  // ---- common ----------------------------------------------------------
  "common.documentsNav": "Documents",
  "common.conversionMode": "Conversion mode",
  "common.providerOpenAI": "OpenAI",
  "common.providerAnthropic": "Anthropic",
  "common.providerDemo": "Demo",
  "common.text": "Text",
  "common.preview": "Preview",
  "common.edit": "Edit",
  "common.cancel": "Cancel",
  "common.reject": "Reject",
  "common.openReview": "Open review",
  "common.fileTooLargeSelfHosted":
    "File is too large. The self-hosted limit is 25 MB.",
  "common.fileTooLargeHosted":
    "File is too large. The hosted demo limit is 4 MB.",
  "common.documentLoadFailedClient":
    "Document could not be loaded in this browser.",
  "common.documentLoadFailed": "Document could not be loaded.",
  "common.exportDownloaded": "{kind} export downloaded.",
  "common.exportFailed": "{kind} export failed.",
  "common.documentFallbackTitle": "Document",

  // ---- header ------------------------------------------------------------
  "header.homeAria": "Docutor home",
  "header.tagline": "Documents → agent-readable Markdown",
  "header.progressAria": "Document conversion progress",
  "header.stepUpload": "Upload",
  "header.stepReview": "Review",
  "header.stepExport": "Export",
  "header.languageToggleAria": "Language",

  // ---- upload page ---------------------------------------------------------
  "upload.title": "Convert a document",
  "upload.description":
    "Upload a PowerPoint, Word, PDF, or image file. Docutor extracts text, tables, and diagrams, then converts them into structured Markdown you can review section by section.",
  "upload.dropzone": "Drop one or more files here, or click to browse",
  "upload.hint": ".pptx · .docx · .pdf · .png · .jpg — max {mb} MB per file",
  "upload.tryDemo": "Try with a sample document",
  "upload.fileReady": "✓ Ready",
  "upload.removeFileAria": "Remove selected file",
  "upload.converting": "Converting document...",
  "upload.convertCta": "Convert document →",
  "upload.chooseFileError": "Choose a PDF, DOCX, PPTX, PNG, or JPG file.",
  "upload.uploadingSource": "Uploading source document...",
  "upload.analyzingOpenAI": "Analyzing the document with OpenAI...",
  "upload.preparingDemo": "Preparing browser-based demo content...",
  "upload.workspaceReady": "Review workspace is ready.",
  "upload.uploadFailed": "Upload failed.",
  "upload.statusUploaded": "Uploaded. Extracting content...",
  "upload.statusNormalizing": "Extracting text, tables, and page images...",
  "upload.statusConverting": "Converting with the LLM provider...",
  "upload.statusFailed": "Conversion failed.",
  "upload.statusWorking": "Working...",

  // ---- batch queue (upload page, 2+ files) --------------------------------
  "batch.filesSelectedOne": "{count} file selected",
  "batch.filesSelectedOther": "{count} files selected",
  "batch.summary": "{ready} of {total} converted{failedSuffix}",
  "batch.summaryFailedSuffix": " · {failed} failed",
  "batch.clearAria": "Clear selected files",
  "batch.statusQueued": "Queued",
  "batch.statusConverting": "Converting…",
  "batch.statusReady": "Ready",
  "batch.statusFailed": "Failed",
  "batch.finishedAlert": "{ready} of {total} documents converted.",
  "batch.viewAllLink": "View all in Documents",
  "batch.convertMore": "Convert more files",
  "batch.converting": "Converting documents...",
  "batch.convertCountOne": "Convert {count} document →",
  "batch.convertCountOther": "Convert {count} documents →",

  // ---- review page ---------------------------------------------------------
  "review.sectionsSummary": "{count} sections · {accepted} accepted",
  "review.acceptedSummary": "{count} sections accepted",
  "review.sectionPageStatus": "Page {page} · {status}",
  "review.needsAttention": "Needs attention",
  "review.originalSourceHeading": "ORIGINAL SOURCE — PAGE {page}",
  "review.pageImage": "Page image",
  "review.originalSourceAlt": "Original source, page {page}",
  "review.originalTextMissing":
    "Original source text was not included for this section.",
  "review.generatedPreview": "GENERATED PREVIEW",
  "review.openDrawioHint":
    "Open the draw.io editor below to inspect this diagram.",
  "review.diagramSource": "DIAGRAM SOURCE",
  "review.generatedMarkdown": "GENERATED MARKDOWN",
  "review.noSections": "No review sections are available.",
  "review.regenerate": "↻ Regenerate",
  "review.regenerating": "↻ Regenerating…",
  "review.regenerateSubmit": "Regenerate",
  "review.instructionPlaceholder":
    "Optional instruction — e.g. 'The arrow between steps 2 and 3 points the wrong way'",
  "review.accept": "✓ Accept",
  "review.acceptConfirm": "Accept with {count} unresolved?",
  "review.sourcePage": "Source: page {page}",
  "review.noMermaidCode": "No Mermaid diagram code.",
  "review.mermaidRenderFailed": "Mermaid rendering failed.",
  "review.savingSection": "Saving section...",
  "review.sectionSavedClient": "Section saved in this browser.",
  "review.sectionUpdateFailed": "Section update failed.",
  "review.sectionSaved": "Section saved.",
  "review.regeneratingSection": "Regenerating section...",
  "review.demoRegenerateNotice":
    "Demo mode: placeholder regeneration only (no LLM was called).",
  "review.sectionRegenerated": "Section regenerated.",
  "review.sectionRegenerationFailed": "Section regeneration failed.",
  "review.reviewedCount": "{reviewed} of {total} sections reviewed",
  "review.downloadMarkdown": "Download Markdown",
  "review.downloadZip": "Download ZIP",
  "review.completeCta": "Complete review →",

  // ---- section status / type labels (section-status.ts) ------------------
  "reviewStatus.accepted": "Accepted",
  "reviewStatus.rejected": "Rejected",
  "reviewStatus.regenerating": "Regenerating",
  "reviewStatus.pending": "Pending review",
  "sectionType.heading": "HEADING",
  "sectionType.text": "TEXT",
  "sectionType.table": "TABLE",
  "sectionType.diagram": "DIAGRAM",
  "sectionType.image": "IMAGE",
  "sectionType.requirement": "REQUIREMENT",
  "sectionType.note": "NOTE",

  // ---- draw.io editor ------------------------------------------------------
  "drawio.editorLabel": "draw.io editor",
  "drawio.loading": "Loading draw.io editor...",
  "drawio.ready": "draw.io editor ready.",
  "drawio.loaded": "draw.io diagram loaded.",
  "drawio.autosaveCaptured": "draw.io changes captured.",
  "drawio.saved": "draw.io XML saved.",
  "drawio.consentText":
    "Opening the editor sends this diagram's XML to {host}, the configured draw.io host, so it can render and let you edit the diagram there. Nothing else on this page is sent.",
  "drawio.openEditor": "Open draw.io editor",
  "drawio.saveXml": "Save draw.io XML",

  // ---- complete page ---------------------------------------------------------
  "complete.readyToExport": "Ready to export",
  "complete.title": "Conversion complete",
  "complete.subtitle": "{file} → structured Markdown knowledge asset",
  "complete.statSections": "Sections",
  "complete.statAccepted": "Accepted",
  "complete.statAttention": "Needs attention",
  "complete.statPages": "Source pages",
  "complete.attentionAlertBefore": "The export contains ",
  "complete.attentionAlertCount": "{count} TODO / Unclear markers",
  "complete.attentionAlertAfter":
    ". Docutor keeps ambiguous source details visible instead of filling them silently.",
  "complete.exportPackageHeading": "EXPORT PACKAGE",
  "complete.exportPackageDesc":
    "Reviewed content bundled for downstream agent workflows",
  "complete.readyForAgents": "Ready for agents",
  "complete.fileMarkdownDetail": "Accepted sections in structured Markdown",
  "complete.fileManifestDetail": "Document metadata and section traceability",
  "complete.fileAssetsDetail": "{count} captured source assets",
  "complete.fileDiagramsDetail": "{count} Mermaid or draw.io source files",
  "complete.fileAgentDetail": "RAG-ready sections and document metadata",
  "complete.typeMarkdown": "Markdown",
  "complete.typeJson": "JSON",
  "complete.typeFolder": "Folder",
  "complete.downloadMarkdown": "↓ Download Markdown",
  "complete.downloadZip": "↓ Download ZIP package",
  "complete.backToReview": "← Back to review",
  "complete.startNew": "Start a new document",

  // ---- documents dashboard ---------------------------------------------------------
  "documents.title": "Document history",
  "documents.description":
    "Every document converted in this browser, plus any converted by a server-hosted deployment. Reopen a review or remove a document you no longer need.",
  "documents.serverUnavailable":
    "Server documents are unavailable right now — showing documents stored in this browser only.",
  "documents.emptyTitle": "No documents yet",
  "documents.emptyDesc": "Convert your first document to see it listed here.",
  "documents.emptyCta": "Convert a document",
  "documents.originClient": "This browser",
  "documents.originServer": "Server",
  "documents.statusReady": "Ready",
  "documents.statusFailed": "Failed",
  "documents.statusConverting": "Converting",
  "documents.statusNormalizing": "Normalizing",
  "documents.statusUploaded": "Uploaded",
  "documents.updatedAt": "Updated {date}",
  "documents.sectionsCountOne": "{count} section",
  "documents.sectionsCountOther": "{count} sections",
  "documents.acceptedCount": "{count} accepted",
  "documents.pendingCount": "{count} pending",
  "documents.rejectedCount": "{count} rejected",
  "documents.delete": "Delete",
  "documents.deleteConfirm": "Delete?",
} as const;

export type Dictionary = typeof en;
export type DictionaryKey = keyof Dictionary;

// `Record<keyof typeof en, string>` (rather than `Dictionary`) means a
// missing ja key is a type error, and an extra/misspelled key is also a
// type error — both dictionaries are forced to have exactly the same key
// set as `en`.
export const ja: Record<keyof typeof en, string> = {
  // ---- common ----------------------------------------------------------
  "common.documentsNav": "ドキュメント",
  "common.conversionMode": "変換モード",
  "common.providerOpenAI": "OpenAI",
  "common.providerAnthropic": "Anthropic",
  "common.providerDemo": "デモ",
  "common.text": "テキスト",
  "common.preview": "プレビュー",
  "common.edit": "編集",
  "common.cancel": "キャンセル",
  "common.reject": "却下",
  "common.openReview": "レビューを開く",
  "common.fileTooLargeSelfHosted":
    "ファイルサイズが上限を超えています。セルフホスト版の上限は25MBです。",
  "common.fileTooLargeHosted":
    "ファイルサイズが上限を超えています。ホスト版デモの上限は4MBです。",
  "common.documentLoadFailedClient":
    "このブラウザではドキュメントを読み込めませんでした。",
  "common.documentLoadFailed": "ドキュメントを読み込めませんでした。",
  "common.exportDownloaded": "{kind} のダウンロードが完了しました。",
  "common.exportFailed": "{kind} のエクスポートに失敗しました。",
  "common.documentFallbackTitle": "ドキュメント",

  // ---- header ------------------------------------------------------------
  "header.homeAria": "Docutor ホーム",
  "header.tagline": "ドキュメント → エージェントが読める Markdown",
  "header.progressAria": "ドキュメント変換の進捗",
  "header.stepUpload": "アップロード",
  "header.stepReview": "レビュー",
  "header.stepExport": "エクスポート",
  "header.languageToggleAria": "言語",

  // ---- upload page ---------------------------------------------------------
  "upload.title": "ドキュメントを変換",
  "upload.description":
    "PowerPoint、Word、PDF、または画像ファイルをアップロードしてください。Docutorがテキスト・表・図を抽出し、セクションごとにレビューできる構造化されたMarkdownに変換します。",
  "upload.dropzone": "ここにファイルをドロップ、またはクリックして選択",
  "upload.hint":
    ".pptx・.docx・.pdf・.png・.jpg — 1ファイルあたり最大{mb}MB",
  "upload.tryDemo": "サンプルドキュメントで試す",
  "upload.fileReady": "✓ 準備完了",
  "upload.removeFileAria": "選択したファイルを削除",
  "upload.converting": "変換中...",
  "upload.convertCta": "ドキュメントを変換 →",
  "upload.chooseFileError":
    "PDF、DOCX、PPTX、PNG、JPGのいずれかのファイルを選択してください。",
  "upload.uploadingSource": "原本ドキュメントをアップロード中...",
  "upload.analyzingOpenAI": "OpenAIでドキュメントを解析中...",
  "upload.preparingDemo": "ブラウザ上のデモコンテンツを準備中...",
  "upload.workspaceReady": "レビュー画面の準備が整いました。",
  "upload.uploadFailed": "アップロードに失敗しました。",
  "upload.statusUploaded": "アップロード完了。内容を抽出中...",
  "upload.statusNormalizing": "テキスト・表・ページ画像を抽出中...",
  "upload.statusConverting": "LLMプロバイダーで変換中...",
  "upload.statusFailed": "変換に失敗しました。",
  "upload.statusWorking": "処理中...",

  // ---- batch queue (upload page, 2+ files) --------------------------------
  "batch.filesSelectedOne": "{count} 件のファイルを選択中",
  "batch.filesSelectedOther": "{count} 件のファイルを選択中",
  "batch.summary": "{total}件中{ready}件変換済み{failedSuffix}",
  "batch.summaryFailedSuffix": " ・失敗{failed}件",
  "batch.clearAria": "選択したファイルをクリア",
  "batch.statusQueued": "待機中",
  "batch.statusConverting": "変換中…",
  "batch.statusReady": "完了",
  "batch.statusFailed": "失敗",
  "batch.finishedAlert": "{total}件中{ready}件を変換しました。",
  "batch.viewAllLink": "ドキュメント一覧で確認",
  "batch.convertMore": "他のファイルを変換",
  "batch.converting": "変換中...",
  "batch.convertCountOne": "{count} 件を変換 →",
  "batch.convertCountOther": "{count} 件を変換 →",

  // ---- review page ---------------------------------------------------------
  "review.sectionsSummary": "{count} セクション ・ {accepted} 件承認",
  "review.acceptedSummary": "{count} 件のセクションを承認済み",
  "review.sectionPageStatus": "{page} ページ ・ {status}",
  "review.needsAttention": "要確認",
  "review.originalSourceHeading": "原本ソース — {page} ページ",
  "review.pageImage": "ページ画像",
  "review.originalSourceAlt": "原本、{page} ページ目",
  "review.originalTextMissing":
    "このセクションには原本テキストが含まれていません。",
  "review.generatedPreview": "生成プレビュー",
  "review.openDrawioHint":
    "この図を確認するには、下の draw.io エディタを開いてください。",
  "review.diagramSource": "図のソース",
  "review.generatedMarkdown": "生成された MARKDOWN",
  "review.noSections": "レビュー対象のセクションがありません。",
  "review.regenerate": "↻ 再生成",
  "review.regenerating": "↻ 再生成中…",
  "review.regenerateSubmit": "再生成",
  "review.instructionPlaceholder":
    "任意の指示 — 例:「手順2と3の間の矢印の向きが逆です」",
  "review.accept": "✓ 承認",
  "review.acceptConfirm": "未解決{count}件のまま承認しますか?",
  "review.sourcePage": "原本: {page} ページ",
  "review.noMermaidCode": "Mermaidの図のコードがありません。",
  "review.mermaidRenderFailed": "Mermaidのレンダリングに失敗しました。",
  "review.savingSection": "セクションを保存中...",
  "review.sectionSavedClient": "このブラウザにセクションを保存しました。",
  "review.sectionUpdateFailed": "セクションの更新に失敗しました。",
  "review.sectionSaved": "セクションを保存しました。",
  "review.regeneratingSection": "セクションを再生成中...",
  "review.demoRegenerateNotice":
    "デモモード: 実際のLLMは呼び出さず、プレースホルダーの再生成のみ行います。",
  "review.sectionRegenerated": "セクションを再生成しました。",
  "review.sectionRegenerationFailed": "セクションの再生成に失敗しました。",
  "review.reviewedCount": "{total}件中{reviewed}件レビュー済み",
  "review.downloadMarkdown": "Markdownをダウンロード",
  "review.downloadZip": "ZIPをダウンロード",
  "review.completeCta": "レビューを完了 →",

  // ---- section status / type labels (section-status.ts) ------------------
  "reviewStatus.accepted": "承認済み",
  "reviewStatus.rejected": "却下",
  "reviewStatus.regenerating": "再生成中",
  "reviewStatus.pending": "レビュー待ち",
  "sectionType.heading": "見出し",
  "sectionType.text": "テキスト",
  "sectionType.table": "表",
  "sectionType.diagram": "図",
  "sectionType.image": "画像",
  "sectionType.requirement": "要件",
  "sectionType.note": "注記",

  // ---- draw.io editor ------------------------------------------------------
  "drawio.editorLabel": "draw.io エディタ",
  "drawio.loading": "draw.io エディタを読み込み中...",
  "drawio.ready": "draw.io エディタの準備ができました。",
  "drawio.loaded": "draw.io の図を読み込みました。",
  "drawio.autosaveCaptured": "draw.io の変更を取得しました。",
  "drawio.saved": "draw.io のXMLを保存しました。",
  "drawio.consentText":
    "エディタを開くと、この図のXMLが設定済みのdraw.ioホストである{host}に送信され、そこで図の表示・編集が行われます。このページの他の情報は送信されません。",
  "drawio.openEditor": "draw.io エディタを開く",
  "drawio.saveXml": "draw.io のXMLを保存",

  // ---- complete page ---------------------------------------------------------
  "complete.readyToExport": "エクスポート準備完了",
  "complete.title": "変換完了",
  "complete.subtitle": "{file} → 構造化された Markdown ナレッジ資産",
  "complete.statSections": "セクション",
  "complete.statAccepted": "承認済み",
  "complete.statAttention": "要確認",
  "complete.statPages": "原本ページ数",
  "complete.attentionAlertBefore": "エクスポートには",
  "complete.attentionAlertCount": "TODO/Unclearマーカーが{count}件",
  "complete.attentionAlertAfter":
    "含まれています。Docutorは曖昧な原本情報を黙って埋めるのではなく、そのまま可視化します。",
  "complete.exportPackageHeading": "エクスポートパッケージ",
  "complete.exportPackageDesc":
    "レビュー済みコンテンツをエージェント向けワークフロー用にまとめたもの",
  "complete.readyForAgents": "エージェント対応済み",
  "complete.fileMarkdownDetail": "承認済みセクションを構造化Markdownで出力",
  "complete.fileManifestDetail": "ドキュメントのメタデータとセクションの追跡情報",
  "complete.fileAssetsDetail": "取得した原本アセット {count} 件",
  "complete.fileDiagramsDetail": "MermaidまたはDraw.ioのソースファイル {count} 件",
  "complete.fileAgentDetail": "RAG向けのセクションとドキュメントメタデータ",
  "complete.typeMarkdown": "Markdown",
  "complete.typeJson": "JSON",
  "complete.typeFolder": "フォルダ",
  "complete.downloadMarkdown": "↓ Markdownをダウンロード",
  "complete.downloadZip": "↓ ZIPパッケージをダウンロード",
  "complete.backToReview": "← レビューに戻る",
  "complete.startNew": "新しいドキュメントを始める",

  // ---- documents dashboard ---------------------------------------------------------
  "documents.title": "ドキュメント履歴",
  "documents.description":
    "このブラウザで変換したすべてのドキュメントと、サーバーホスト版で変換したドキュメントを表示します。レビューを再開したり、不要なドキュメントを削除したりできます。",
  "documents.serverUnavailable":
    "現在サーバー上のドキュメントを取得できません — このブラウザに保存されたドキュメントのみ表示しています。",
  "documents.emptyTitle": "ドキュメントはまだありません",
  "documents.emptyDesc": "最初のドキュメントを変換すると、ここに表示されます。",
  "documents.emptyCta": "ドキュメントを変換",
  "documents.originClient": "このブラウザ",
  "documents.originServer": "サーバー",
  "documents.statusReady": "完了",
  "documents.statusFailed": "失敗",
  "documents.statusConverting": "変換中",
  "documents.statusNormalizing": "正規化中",
  "documents.statusUploaded": "アップロード済み",
  "documents.updatedAt": "更新日時 {date}",
  "documents.sectionsCountOne": "{count} セクション",
  "documents.sectionsCountOther": "{count} セクション",
  "documents.acceptedCount": "{count} 件承認",
  "documents.pendingCount": "{count} 件保留",
  "documents.rejectedCount": "{count} 件却下",
  "documents.delete": "削除",
  "documents.deleteConfirm": "削除しますか?",
};

// Minimal named-placeholder interpolation: replaces `{key}` occurrences in
// `template` with `params[key]`. Placeholders with no matching param are
// left untouched (rather than blanked out) so a missing param is obvious in
// the rendered UI instead of silently disappearing.
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
