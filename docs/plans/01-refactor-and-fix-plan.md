# Docutor 修正・リファクタリング計画(実行役向けプランファイル)

作成日: 2026-07-08
対象ブランチ: 実行時に指示されたブランチ上で作業すること
関連ファイル: `docs/plans/02-feature-roadmap-plan.md`(新機能計画。本ファイルの P0/P1 完了後に着手)

## 目的

Docutor の掲げる価値は「PowerPoint / Word / PDF / 図が多い企業文書を、人と AI エージェント
が検査・修正・利用できる構造化 Markdown に変換する。図の変換は human-in-the-loop で、
原本の図と生成された Mermaid / draw.io を並べて比較・修正できる」こと(README 参照)。

コードベース全体を検証した結果、ビルド・lint・ユニットテスト(14件)はすべて成功する一方、
**コアバリューのうち複数が UI から機能していない、または誤った結果を出す**ことを確認した。
本プランはそれらの修正と、修正を安全に行うためのリファクタリングを定義する。

## 検証済みの現状(2026-07-08 時点)

動作しているもの:

- `pnpm build` / `pnpm lint` / `pnpm test` はすべて成功。
- アップロード画面 → `POST /api/convert-direct`(ファイルを直接 OpenAI に渡す経路)→
  レビュー画面 → localStorage 保存 → Markdown / ZIP エクスポート、という「ホスト版デモ経路」。
- ブラウザ内デモ(mock)経路(`createDemoDocument`)。

機能していない・誤動作するもの(詳細は下記タスク):

- サーバーサイド本来のパイプライン(`POST /api/documents` → Python Worker で正規化 →
  プロバイダ変換)が **UI のどこからも呼ばれておらず到達不能**。
- 図セクションで「原本ページ画像と生成図の比較」が **未実装**(画像が一切表示されない)。
- Mermaid コードを編集してもエクスポートに反映されない(古い図が出力される)。
- Regenerate ボタンが常に mock プロバイダで動く。
- セクションを 1 つでも Reject するとレビューを完了できない。

---

## タスク一覧

優先度: P0 = コアバリューを毀損する欠陥。P1 = 品質・保守性上の重要課題。P2 = 改善。
各タスクは独立してコミットできる粒度にすること。タスクごとに `pnpm test` と `pnpm lint` を通すこと。

### P0-1. 図セクションの「原本画像 vs 生成図」比較を実装する

**背景**: README の Product Principle の中核(「Show the original diagram image」)だが、
`src/app/review/[id]/page.tsx` は図セクションでも `originalText`(テキスト)しか表示しない。
`sourceImage` はどこにも描画されず、そもそもサーバー保存アセットを配信する API ルートが存在しない。
さらに `convert-direct` 経路では `sourceImage` が常に空文字。

**変更対象**:
- 新規: `src/app/api/documents/[id]/assets/[assetId]/route.ts`(アセット配信 GET)
- `src/app/review/[id]/page.tsx`(図セクションの ORIGINAL SOURCE ペインで画像描画)
- `src/app/api/convert-direct/route.ts` / `src/lib/llm/openai-provider.ts`(direct 経路でも
  原本画像を保持できるようにする — 少なくとも image アップロード時は入力画像自体を
  data URL として `sourceImage` に入れられる)

**実装内容**:
1. アセット配信ルートを追加する。`ReviewAsset.path` / `NormalizedAsset.path` は
   `runtime/documents/<id>/` 配下の絶対パスなので、**パストラバーサル対策として
   ドキュメントディレクトリ配下であることを検証**してから `fs` で読み出して返す。
   セクションの `sourceImage` はファイルパスではなく `/api/documents/<id>/assets/<assetId>`
   形式の URL(またはアセット ID)に正規化する。
2. レビュー画面の図セクション左ペインで、`sourceImage` があれば `<img>` を表示し、
   なければ現状どおり `originalText` にフォールバックする。非図セクションでも
   `sourceImage` があれば原文テキストの下に表示する。
3. direct 経路(画像アップロード)では入力画像を `sourceImage`(data URL)に設定する。
   PDF/Office の direct 経路ではページ画像が得られないため、`warnings` に
   「原本画像比較はサーバーパイプラインでのみ利用可能」と明記する。

**受け入れ基準**:
- サーバーパイプラインで変換した文書の図セクションで、原本ページ画像と Mermaid プレビューが
  左右に並んで表示される。
- `/api/documents/<id>/assets/../../etc/passwd` のようなリクエストが 400/404 になる。

### P0-2. Mermaid コード編集をエクスポートへ正しく反映する

**背景**: 図セクションで `generatedCode`(Mermaid)を編集・保存しても `generatedMarkdown` は
更新されない。一方エクスポート(`src/lib/export/markdown.ts` の `renderSection`)は
`generatedMarkdown` が非空ならそれを優先するため、**ユーザーが修正した図ではなく
変換直後の古い図がエクスポートされる**。human-in-the-loop 修正の意味が失われる正確性バグ。

**変更対象**:
- `src/lib/export/markdown.ts`
- `src/app/review/[id]/page.tsx` / `src/app/api/documents/[id]/sections/[sectionId]/route.ts` /
  `src/lib/client-document-store.ts`(どちらの層で整合させるか選ぶ)

**実装内容**(推奨案): 図セクションでは `generatedCode` を唯一の真実とし、
`renderSection` は diagram セクションで常に `generatedCode` から Mermaid フェンスを再構築する
(`generatedMarkdown` は図セクションでは補足テキスト扱いにするか無視する)。
併せて、セクション PATCH で `generatedCode` を更新した際に `generatedMarkdown` の
mermaid フェンスも同期させる正規化関数を `src/lib` に置き、サーバー PATCH ルートと
`patchClientSection` の両方から呼ぶ。

**受け入れ基準**:
- Mermaid コードを編集 → Accept → Markdown / ZIP エクスポートで、編集後のコードが出力される。
- `tests/unit/markdown-export.test.ts` に「編集後の generatedCode が優先される」ケースを追加。

### P0-3. Regenerate を実際のプロバイダで動かし、UI から偽装をなくす

**背景**: `src/app/review/[id]/page.tsx` の `regenerateSection` は
サーバー文書に対して `?provider=mock` を **ハードコード** しており、OpenAI で変換した文書でも
mock がコメントを追記するだけ。クライアント文書(direct/demo)では文字列追記の偽再生成を行う。

**変更対象**:
- `src/app/review/[id]/page.tsx`
- `src/app/api/convert-direct/route.ts` または新規 `src/app/api/convert-direct/regenerate/route.ts`

**実装内容**:
1. サーバー文書の再生成では provider クエリを付けず、サーバー既定
   (`DOCUTOR_LLM_PROVIDER`)に任せる。
2. direct 文書用に、セクション JSON を受け取り OpenAI で 1 セクションだけ再生成して返す
   ステートレス API(`POST /api/convert-direct/regenerate`)を追加し、クライアント文書は
   demo(`demo-` prefix)以外はこれを呼ぶ。demo 文書のみ現行の文字列追記を維持してよいが、
   メッセージで「デモのため擬似再生成」と明示する。

**受け入れ基準**:
- OpenAI で変換した文書の Regenerate が実際に LLM を呼び、内容が再生成される。
- 失敗時は元のセクションが保持され、エラーがメッセージ表示される。

### P0-4. レビュー完了条件の修正(Reject がデッドエンドになる問題)

**背景**: フッターの「Complete review」は `acceptedCount !== sections.length` で無効化される。
1 セクションでも Reject すると **完了手段がなくなる**。README のフローは Accept / Reject /
Regenerate を並列の判断としており、Reject は「この生成物は最終成果物に含めない」を意味するはず。

**変更対象**: `src/app/review/[id]/page.tsx`

**実装内容**: 完了条件を「全セクションが accepted または rejected(= pending / regenerating が 0)」
に変更する。エクスポート(accepted のみ出力)は現行仕様のままでよい。
フッターの文言も「X of Y reviewed」に合わせる。

**受け入れ基準**: 一部 Reject を含む文書でも全セクション判断済みなら Complete へ進める。

### P1-1. サーバーパイプライン(Python Worker 経路)を UI から使えるようにする、または明示的に切り離す

**背景**: `POST /api/documents` → `POST /api/documents/[id]/convert`(Python Worker 正規化 →
プロバイダ変換)という本来のパイプラインが UI から一切呼ばれていない。
`workers/python/worker.py`(768行)、`python-worker.ts`、`storage.ts`、`mock-provider.ts`、
`codex-local-provider.ts` はユーザー視点ではデッドコード。README の Core Product Flow
(抽出 → 変換)はこの経路でしか成立しない。

**変更対象**:
- `src/app/page.tsx`(アップロード画面)
- 必要なら `src/app/api/documents/[id]/route.ts`(ポーリング用に status を返すのは実装済み)

**実装内容**:
1. 実行環境判定(例: `NEXT_PUBLIC_DOCUTOR_MODE=self-hosted|hosted`)を導入し、
   self-hosted ではアップロード画面が `POST /api/documents` → `POST .../convert` を呼ぶ。
   hosted(Vercel)では現行の convert-direct 経路を使う。
2. 変換中は `GET /api/documents/[id]` をポーリングして `status`
   (`normalizing` → `converting` → `ready` / `failed`)を進捗表示に反映する。
   これに伴い現在のハードコード進捗(24/52/68/100%)を実状態ベースに置き換える。
3. プロバイダ選択トグル(OpenAI / Demo)を self-hosted では `openai / mock` の
   provider クエリとして convert API に渡す。

**受け入れ基準**:
- ローカル環境(Python + poppler + LibreOffice あり)で、PDF をアップロードすると
  Python Worker が動き、ページ画像付きのレビュー文書が生成され、P0-1 の比較ビューが機能する。
- Vercel 相当(worker なし)でも従来どおり convert-direct で動く。

### P1-2. LLM 出力スキーマの最小化とメタデータのサーバー側付与

**背景**: `src/lib/llm/review-document-schema.ts` は `id` / `createdAt` / `updatedAt` /
`reviewStatus` / `sourceFileName` / `assets` までモデルに生成させている。トークンの無駄かつ
改ざん・不整合の温床(現に `openai-provider.ts` は `output.createdAt || now` と
モデル生成のタイムスタンプを信用している)。また `prompts.ts` は正規化 JSON に含まれる
**サーバーの絶対パス**をそのままプロンプトへ埋め込んでいる。

**変更対象**:
- `src/lib/llm/review-document-schema.ts`(コンテンツ項目のみに縮小)
- `src/lib/llm/review-document-normalizer.ts` / `openai-provider.ts` / `codex-local-provider.ts`
- `src/lib/llm/prompts.ts`(アセットはページ番号と ID のみ渡す。絶対パスを渡さない。
  `sourceImage` はモデルに書かせず、`sourcePage` からサーバー側で解決する)

**実装内容**: スキーマから `id`(文書)、`createdAt`、`updatedAt`、`reviewStatus`、
`sourceFileName`、`sourceFileType`、`assets` を除去し、これらはすべて変換後にコードで付与する。
セクション `id` は `sec_<n>` をコード側で採番してもよい(再生成時の同一性維持に注意)。
`as ReviewDocument` / `as ReviewSection` の型キャストを排除し、正規化関数が完全な型を返すようにする。

**受け入れ基準**:
- `tests/unit/openai-schema.test.ts` を新スキーマに追随させ、メタデータがコード側で
  決定されることをテストで固定する。
- プロンプト文字列に `runtime/documents` を含むパスが現れない。

### P1-3. クライアント/サーバー二重実装の統合

**背景**: 同じロジックが 2 系統に重複している。
- エクスポート: `src/lib/export/zip.ts`(サーバー)と `buildClientExport`
  (`src/lib/client-document-store.ts`)で ZIP 構成・manifest が微妙に異なる。
- セクション更新: PATCH ルートと `patchClientSection`。
- ファイル種別判定: `src/lib/file-types.ts` の `detectSourceFileType`(未対応は null)と
  `client-document-store.ts` 内ローカル `detectFileType`(**未対応でも "pdf" にフォールバック**、
  という不整合あり)。

**変更対象**: 上記各ファイル + 新規 `src/lib/document-model.ts`(仮名)

**実装内容**:
1. セクション patch 適用・updatedAt 更新・(P0-2 の)markdown/code 同期を純粋関数として
   共通モジュールに抽出し、API ルートと client store の両方から使う。
2. ZIP 構成(document.md / manifest.json / diagrams/)の組み立てを共通化し、
   アセットファイルの読み込みだけサーバー側で注入する形にする。manifest の内容を一本化する。
3. `client-document-store.ts` のローカル `detectFileType` を削除し
   `detectSourceFileType` を使う(フォールバックが必要なら呼び出し側で明示)。

**受け入れ基準**: 既存テストがすべて通り、client/server それぞれの ZIP に同一構造の
manifest が含まれる。重複関数が残っていない。

### P1-4. `review/[id]/page.tsx`(725行)のコンポーネント分割とデータ層の整理

**背景**: レビュー画面 1 ファイルに、Mermaid プレビュー、draw.io 埋め込みエディタ、
セクションリスト、レビュー操作、エクスポート、データ取得が同居しており、P0 修正の
影響範囲が読めない。また `loadDocument` の `fetch` に try/catch がなく、ネットワーク
エラー時は unhandled rejection になり画面にエラーが出ない。

**変更対象 / 実装内容**:
- `src/app/review/[id]/` 配下に `mermaid-preview.tsx`、`drawio-editor.tsx`、
  `section-list.tsx`、`section-detail.tsx`(図/非図)を切り出す。
- 文書の取得・保存・再生成を `use-review-document.ts` カスタムフックに集約し、
  client 文書(localStorage)と server 文書(API)の分岐をフック内に閉じ込める。
- すべての fetch に try/catch を付け、失敗時はメッセージ表示。連打防止に保存中フラグを持つ。

**受け入れ基準**: 挙動を変えずに分割が完了し(P0 系修正込みの挙動)、
`page.tsx` が 200 行程度以下になる。lint / build が通る。

### P2-1. draw.io 埋め込みのプライバシー明示(企業文書の外部送信)

**背景**: `DrawioEditor` は `https://embed.diagrams.net` の iframe に図データを postMessage で
送る。対象ユーザーは機密性の高い日本企業の文書であり、無告知の外部送信は問題。

**実装内容**: draw.io エディタを開く前に「図データが diagrams.net に送信される」旨の
確認 UI を挟む。環境変数(例: `NEXT_PUBLIC_DRAWIO_EMBED_URL`)でセルフホスト URL に
差し替え可能にする。

### P2-2. 細かい欠陥の一括修正

1. `src/app/api/convert-direct/route.ts` の `export const MAX_DIRECT_UPLOAD_BYTES` —
   ルートファイルから非ハンドラを export しない(定数は `src/lib` へ移動)。
2. `regenerate/route.ts` の失敗パスが `regeneratingJob` ではなく古い `document` を土台に
   保存しており、直前の状態更新を上書きする。`regeneratingJob` 基準に修正。
3. `openai-provider.ts` の `MAX_PAGE_IMAGES = 6` 超過時、切り捨てたページを `warnings` に追記する。
4. Python Worker の DOCX 正規化が全テキストを 1 ページ目に割り当てる件 —
   すぐに直せない場合は `warnings` に「DOCX のページ対応付けは近似」と出す。
5. `complete/[id]/page.tsx` のエクスポートパッケージ一覧が実際の ZIP 内容と乖離
   (client 経路では assets/ が入らないのに常に表示)。実データから導出する。
6. アップロード画面の進捗バーのハードコード値を P1-1 のステータス連動に置き換える
   (P1-1 に含めてよい)。
7. `next` / `react` / `eslint-config-next` 等の `"latest"` 指定をバージョン固定に変える
   (再現性のため)。

---

## 実施順序

1. P0-2(エクスポート正確性。最小 diff・テスト追加が容易)
2. P0-4(完了条件。1 行レベル)
3. P0-1(アセット配信 + 比較ビュー)
4. P0-3(実プロバイダでの再生成)
5. P1-4(分割。以降の作業の土台)→ P1-3(共通化)→ P1-2(スキーマ)→ P1-1(パイプライン接続)
6. P2 系

## 検証方法(全タスク共通)

- `pnpm test` / `pnpm lint` / `pnpm build` がすべて成功すること。
- 修正対象ごとにユニットテストを追加すること(特に P0-2、P1-2、P1-3 は純粋関数なのでテスト必須)。
- 手動確認: `DOCUTOR_LLM_PROVIDER=mock pnpm dev` で「Try with a sample document」→
  レビュー → Mermaid 編集 → Accept → エクスポートの一連を通し、編集内容が
  document.md に反映されることを確認する。
- サーバーパイプライン確認(P0-1 / P1-1)は Python + pdfplumber + poppler + LibreOffice の
  ある環境で `tests/input_test/` のサンプル PPTX を使う。
