<p align="right"><a href="README.md">English</a> | 日本語</p>

# Docutor MVP

<p align="center">
  <img src="docs/assets/docutor-image.png" alt="Docutor - From messy docs to clear knowledge" width="520">
</p>

Docutorは、煩雑なエンタープライズ文書を、AIエージェントが読めるクリーンな
Markdownに変換します。

想定ユーザーは、重要な仕様書・業務フロー・ビジネスルールがPowerPoint、
Word、PDF、図表の多いドキュメントの中に埋もれてしまっている、伝統的な
日本企業です。

Docutorは単純なOCRやファイル変換ツールを目指すものではありません。目的は、
非構造化のビジネス文書を、人間とAIエージェントの両方が確認・修正・活用
できる構造化されたナレッジ資産へと変換することです。

## プロダクトデモ

[![Docutor product walkthrough](docs/assets/how-docutor-works.gif)](docs/assets/how-docutor-works.mp4)

[音声付き・フル解像度で見る](docs/assets/how-docutor-works.mp4)

## はじめに

### 前提条件

- **Node.js >= 22.13** — このリポジトリは `.nvmrc` で `22.22.0` を指定しています。nvmを使っている場合は `nvm use` を実行してください。
- **pnpm 11.7.0**（Node同梱のCorepack経由で管理）。`pnpm` が指定バージョンを解決しない場合は、一度だけ `corepack enable` を実行してください。
- 既定のホストモードで実際に変換を行う場合は **OpenAI APIキー** が必要です（`mock` プロバイダーはAPIキーなしで動作します）。その他の選択肢（Anthropic、codex-local）は[プロバイダー](#プロバイダー)を参照してください。

以下は**セルフホストモード**（[モード](#モード)を参照）でのみ必要です。既定のホストモードではいずれも不要です。

- ドキュメント抽出用の **Python 3**（`pdfplumber` と `Pillow` が必要）:

  ```bash
  pip install pdfplumber Pillow
  ```

- PDFのテキストおよびページ画像抽出用の **Poppler utilities**（`pdftoppm`、`pdfinfo`、`pdftotext`）:

  ```bash
  brew install poppler   # macOS
  ```

- DOCX/PPTXのページを画像としてレンダリングするための **LibreOffice**（`soffice` がPATH上にあること）:

  ```bash
  brew install --cask libreoffice   # macOS
  ```

### セットアップ

```bash
git clone https://github.com/EitaroY/Docutor.git
cd Docutor
nvm use              # 任意。.nvmrcで指定されたNodeバージョンに合わせます
pnpm install
cp sample.env.local .env.local
```

`.env.local` を開いて `OPENAI_API_KEY` を設定してください（もしくは
`DOCUTOR_LLM_PROVIDER=mock` のままにしておけば、APIキーなしで実行できます）。
全変数の一覧は[環境変数](#環境変数)を参照してください。

```bash
pnpm dev
```

その後、[http://localhost:3000](http://localhost:3000) を開いてください。

### 便利なスクリプト

- `pnpm dev` — Next.jsの開発サーバーを起動
- `pnpm build` — 本番ビルド
- `pnpm lint` — ESLintを実行
- `pnpm test` — Vitestによる単体テストスイートを実行（108テスト）

## モード

Docutorは `NEXT_PUBLIC_DOCUTOR_MODE` で選択する2つのアプリモードで動作します。

| | ホスト（既定） | セルフホスト |
| --- | --- | --- |
| 有効化 | 未設定、または `NEXT_PUBLIC_DOCUTOR_MODE=hosted` | `NEXT_PUBLIC_DOCUTOR_MODE=self-hosted` |
| アップロード経路 | `POST /api/convert-direct` | `POST /api/documents` → `POST /api/documents/[id]/convert` |
| 最大ファイルサイズ | 4 MB | 25 MB |
| システム依存関係 | なし — 純粋なNodeのみで、Vercelなどのサーバーレス環境で動作 | Python 3 + `pdfplumber`/`Pillow`、Poppler、LibreOffice（[前提条件](#前提条件)を参照） |
| ページ抽出 | ファイルはそのままLLMプロバイダーに送られる。ページ画像は生成されないため、レビュー画面の「Page image」タブは理由付きで無効化される（画像ファイルのアップロード自体はそのまま表示される） | Pythonワーカーによる本格的なページ画像抽出・正規化 |
| 大容量文書 | 分割なしの単発呼び出し（アップロード上限により扱いやすいサイズに収まる） | ページ分割変換 — 文書をページウィンドウ（`DOCUTOR_PAGES_PER_CHUNK`、既定6ページ）に分割してプロバイダーを複数回呼び出し、1つの文書にマージ。「Converting pages 7-12 of 23…」のようなリアルタイム進捗表示付き |
| 利用可能なプロバイダー | `DOCUTOR_LLM_PROVIDER` の値によらずOpenAIのみ | `openai`、`anthropic`、`mock`、`codex-local` をリクエスト単位で選択可能（[プロバイダー](#プロバイダー)を参照） |
| ストレージ | ブラウザの `localStorage` のみ | サーバー側の `DocumentRepository`（`DOCUTOR_STORAGE_DRIVER`、既定は `runtime/documents/` 配下の `filesystem`） |

## プロバイダー

文書変換とセクション再生成はどちらも同一の `ConversionProvider` インターフェースを経由するため、プロバイダーはそのまま差し替え可能です。

| プロバイダー | 文書変換 | セクション再生成 | 必要な環境変数 | 利用可能な範囲 |
| --- | --- | --- | --- | --- |
| `openai` | 可 | 可 | `OPENAI_API_KEY`（必須）、`OPENAI_MODEL`（既定 `gpt-5.5`） | ホスト（唯一の選択肢）およびセルフホスト |
| `anthropic` | 可 | 可 | `ANTHROPIC_API_KEY`（必須）、`ANTHROPIC_MODEL`（既定 `claude-sonnet-5`） | セルフホストのサーバーパイプラインのみ |
| `mock` | 可 | 可 | なし | セルフホストのサーバーパイプライン（`DOCUTOR_LLM_PROVIDER=mock`）、およびホスト版アップロード画面の「Demo」トグル（完全にクライアント側で完結し、サーバー呼び出しなし） |
| `codex-local` | 可 | 可 | `DOCUTOR_ENABLE_CODEX_LOCAL=1`（有効化に必須）、`CODEX_MODEL`（任意）、`codex` CLIがPATH上にあること | セルフホストのサーバーパイプラインのみ。既定では無効 |

ホストの `/api/convert-direct` は常にOpenAIプロバイダーを直接使用します — これは依存関係なしで動く高速なサーバーレス経路であり、意図的にOpenAI専用としています。セルフホストの変換エンドポイントは `?provider=` クエリパラメータでリクエストごとにプロバイダーを選択でき、省略時は `DOCUTOR_LLM_PROVIDER` にフォールバックします。

## 環境変数

すべての変数は `sample.env.local` にあります。`.env.local` にコピーして必要な値を設定してください。

| 変数 | 用途 | 既定値 |
| --- | --- | --- |
| `OPENAI_API_KEY` | `openai` プロバイダーに必須（ホストモードおよび任意でセルフホストモードが使用） | *(空 — OpenAI利用には必須)* |
| `OPENAI_MODEL` | OpenAIプロバイダーが使用するモデル | `gpt-5.5` |
| `ANTHROPIC_API_KEY` | `anthropic` プロバイダーに必須（セルフホストのサーバーパイプラインのみ） | *(空 — Anthropic利用には必須)* |
| `ANTHROPIC_MODEL` | Anthropicプロバイダーが使用するモデル | `claude-sonnet-5` |
| `DOCUTOR_LLM_PROVIDER` | セルフホストパイプラインの既定プロバイダー: `openai`、`anthropic`、`mock`、`codex-local`（`?provider=` でリクエストごとに上書き可能） | `openai` |
| `DOCUTOR_PYTHON_BIN` | 抽出ワーカーの実行に使うPython 3実行ファイル（セルフホストのみ） | `python3` |
| `DOCUTOR_ENABLE_CODEX_LOCAL` | `1` にすると `codex-local` プロバイダーを有効化 | `0`（無効） |
| `CODEX_MODEL` | `codex-local` 使用時に `codex app-server` へ渡すモデルID | *(空 — 任意)* |
| `DOCUTOR_PAGES_PER_CHUNK` | セルフホストのみ: 大容量文書を分割する際の `provider.convert()` 1回あたりのページ数（F-10） | `6`（プロバイダー1呼び出しあたりのページ画像上限6枚と一致） |
| `NEXT_PUBLIC_DOCUTOR_MODE` | `hosted` / `self-hosted` のアプリモードを選択（[モード](#モード)を参照） | `hosted` |
| `NEXT_PUBLIC_DRAWIO_EMBED_URL` | 図表エディタが使用するdraw.ioの埋め込みホスト。セルフホストのdraw.ioインスタンスを指定すると図表XMLを社内に留められる（公開ホスト向けの外部送信同意プロンプトも省略される） | `https://embed.diagrams.net` |
| `DOCUTOR_STORAGE_DRIVER` | サーバー側文書ジョブ（原本・抽出アセット・ジョブメタデータ）のストレージバックエンド。現状は `filesystem` のみ実装済み。`vercel-blob` は計画中で、`filesystem` 以外の値は「unsupported storage driver」エラーで即座に失敗する | `filesystem` |
| `DOCUTOR_STORAGE_ROOT` | セルフホストの `filesystem` ドライバのみ: 文書ジョブの保存先ディレクトリ。既定値でほぼ問題ないため `sample.env.local` には含まれていない。アプリの作業ディレクトリ以外に保存先を変更したい場合に設定する | `runtime/documents`（プロセスの作業ディレクトリからの相対パス） |

## コアプロダクトフロー

1. PowerPoint、Word、PDF、PNG、またはJPGファイルをアップロードする — 単一ファイル、またはバッチキューで複数ファイルを一括アップロードする（1件ずつ順番に変換され、ファイルごとに待機/変換中/完了/失敗のステータスが表示される。サイズ超過のファイルは送信前に即座にエラー表示される）。
2. 文書が抽出・正規化される: セルフホストモードではテキスト、ページ画像、表、図表候補を抽出し、ホストモードではファイルをそのままLLMプロバイダーに送信する。
3. セルフホストの大容量文書はページウィンドウ単位で変換され、1つの文書にマージされる。各ウィンドウの完了に応じて進捗が表示される。
4. 生成された各セクションを原本と突き合わせてレビューする: **Text** タブ（抽出されたページテキスト）と **Page image** タブ（原本ページのズーム可能なスナップショット）を切り替えて、どのセクションの出典も確認できる。
5. Regenerateポップオーバーからセクションを再生成する。自由記述の指示（例:「矢印の向きが逆」「表の3列目が欠けている」など）を任意で追加でき、その指示はモデル自身のnotesと並んで `[instruction] ...` という監査証跡としてセクションに記録される。
6. 元の図表キャプチャと生成されたMermaidまたはdraw.ioの出力を比較する。図表コード（またはdraw.io埋め込みエディタ）を編集し、結果をプレビューする。
7. TODO/Unclear品質パネルを使い、未解決の `TODO:` / `Unclear:` マーカーが残っているセクションへ直接ジャンプする。マーカーが残ったままのセクションを承認しようとすると、ブロックはされないが確認が表示される。
8. 各セクションを承認、却下、または再生成し、レビューを完了する。
9. 最終的なMarkdown、図表、エージェント対応のRAGバンドルをエクスポートする（[エクスポート](#エクスポート)を参照）。
10. `/documents` 履歴ダッシュボードから過去の変換をいつでも再開できる。ブラウザローカルとサーバー保存の両方の文書がステータスおよびaccepted/pending/rejected件数とともに一覧表示され、削除もできる。

## エクスポート

レビューを完了すると、以下が生成されます。

- **`document.md`** — 承認済みセクションのみを含み、YAMLフロントマター（`title`、`source`、`generated`、`warnings`）に続けて各セクションの本文が並ぶ。図表セクションは古いスナップショットではなく、常に最新の `generatedCode` からレンダリングされる。
- **`manifest.json`** — エクスポートのメタデータ: 文書ID、原本ファイル名/種別、エクスポート日時、承認済みセクションID、アセット一覧。
- **`diagrams/*.mmd`** および **`diagrams/*.drawio`** — 図表セクションごとに、保有している形式のファイルを出力。
- **`agent/sections.jsonl`** — 承認済みセクション1件につきJSONオブジェクト1行、独立したRAGチャンクとして構成: `id`、`type`、`title`、`sourceFile`、`sourcePage`、`markdown`、`reviewStatus`。存在する場合は `notes`、図表セクションでは `mermaid` / `drawioXml` も含む。
- **`agent/document.json`** — 文書レベルのメタデータ: タイトル、原本ファイル、変換/エクスポート日時、警告、セクションの並び順全体、承認済みセクションID。

ZIPエクスポートには上記すべて（加えて、抽出済みの画像・ページキャプチャがある場合は `assets/` フォルダ）が含まれます。単体のMarkdownエクスポートは `document.md` のみを返します。

## MVPスコープ — 達成済み

以下の当初のMVPスコープは `main` にすでに実装済みであり、その後の各マイルストーンで追加された機能もすべて含まれています（全体の経緯は `docs/plans/02-feature-roadmap-plan.md` を参照）。現在の機能セットは次のとおりです。

- 単一ファイルおよび複数ファイルのバッチアップロードとキューUI（ファイルごとの待機/変換中/完了/失敗ステータス。1件ずつ順番に変換するため、1件の失敗が他のファイルをブロックしない）。
- ホストモードとセルフホストモードの2つのアプリモード（[モード](#モード)を参照）。
- 単一インターフェースの背後にある4つの変換プロバイダー — `openai`、`anthropic`、`mock`、`codex-local`。実プロバイダーを2社独立実装したことで、抽象化が特定ベンダーへのハードコードでないことを実証している([プロバイダー](#プロバイダー)を参照)。
- セルフホストの大容量文書向けページ分割変換（`DOCUTOR_PAGES_PER_CHUNK`）。
- ストレージ抽象化（`DocumentRepository`）。現在はセルフホストモードが使うファイルシステム実装があり、Vercel Blob/KV実装は設計済みだが未実装。
- 全セクションで利用できる、原本ページの **Text** / **Page image** 比較タブ（ズーム対応）。
- レビュアーの指示履歴が監査証跡として残る、指示付き再生成。
- 該当セクションへのジャンプ機能と、未解決マーカーがあるセクションを承認する際の確認付き、TODO/Unclear品質パネル。
- 両方のストレージバックエンドを横断する `/documents` 履歴ダッシュボード（削除対応）。
- 人間向けのMarkdown/YAMLフロントマターのエクスポートに加え、エージェント対応のRAGエクスポートバンドル（`agent/sections.jsonl` + `agent/document.json`）。
- 完全な日本語UI: 160以上のキーを持つ型安全な辞書に支えられたEN/日本語トグル。`localStorage` に永続化される。
- プロバイダー、ページ分割変換、エクスポートビルダーなどをカバーする108件のVitest単体テスト。

## プロダクト原則

図表変換は、設計段階からヒューマン・イン・ザ・ループであるべきです。

LLM/VLMの出力は、特に矢印、グルーピング、レイアウト、分岐、曖昧な関係性
について不完全になることが多いです。そのため、次のワークフローが重要
になります:

- 元の図表画像を表示する。
- 生成されたMermaidまたはdraw.ioの表現を表示する。
- ユーザーが生成されたコードを編集できるようにする。
- 更新された図表をプレビューする。
- セクションを承認、却下、または再生成する。

図表については、Docutorはピクセル単位の完璧なレイアウトよりも意味的な
正確さを優先します:

- ノードのラベル
- 矢印の方向
- 関係性
- 分岐条件
- グルーピング
- 階層構造
- ワークフローの順序

## 想定技術スタック

- TypeScript
- Next.js
- React
- Tailwind CSS
- 必要に応じてshadcn/ui
- Mermaid.js
- Node.js / Next.js APIルート
- Pythonワーカー（`pdfplumber`、`Pillow`。PopplerとLibreOfficeを呼び出す）— セルフホストのサーバーパイプラインのみ

draw.ioサポートは、埋め込みのdiagrams.netエディタ（`NEXT_PUBLIC_DRAWIO_EMBED_URL`）として統合されており、公開埋め込みホストを使う場合は外部送信の同意プロンプトが表示されます。

## データモデル

ドキュメントは、レビュー可能なセクションで構成されます。

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

## 変換ルール

ドキュメントを変換する際は:

- 元の意味を保持する。
- 不足しているルールを勝手に作らない。
- ギャップを黙って埋めない。
- 不明瞭な内容は `TODO:` または `Unclear:` としてマークする。
- AIエージェント向けにコンテンツを構造化する。
- ビジネスルール、要件、制約、例外、ワークフローを分離する。
- 表をMarkdownの表に変換する。
- シンプルな図表をMermaidに変換する。
- Mermaidでうまく表現できない図表には、draw.io互換の構造を使用する。

## 画面構成

1. アップロード画面（単一ファイル、または複数ファイルのバッチキュー）
2. レビュー画面（セクション一覧、原本ページのText/Page imageタブ、品質パネル、指示付き再生成ポップオーバー）
3. `/documents` 履歴ダッシュボード
4. 完了・エクスポート画面

UIは、落ち着いていて、構造化されており、繰り返しのレビュー作業でも
一目で把握できる、静かなエンタープライズSaaSツールのように感じられる
べきです。

## 完了基準 — 達成済み

当初のMVP完了基準はすべて満たされており、上記の機能セット全体をエンドツーエンドでカバーしています。ユーザーは以下を行えます。

1. ファイル、または複数ファイルのバッチ（PDF、DOCX、PPTX、PNG、JPG）をアップロードする。
2. 実際のLLMプロバイダーによる変換済みドキュメントを取得する。あるいはセットアップ不要のデモとして `mock` プロバイダーを使う。
3. 生成されたセクションを、原本ページ（テキストまたはズーム可能なページ画像）と突き合わせてレビューする。
4. 元の図表画像と、生成されたMermaidまたはdraw.io図を比較する。
5. 図表コードを編集し、更新結果をプレビューする。
6. 自由記述の指示を付けて再生成をリクエストし、それが反映される様子を確認する。指示はセクションのnotesに記録される。
7. セクションを承認する前に、品質パネルからTODO/Unclearマーカーを解決する。
8. 各セクションを承認、却下、または再生成する。
9. 「完了」をクリックし、Markdown、図表、エージェント対応のRAGバンドルをエクスポートする。
10. `/documents` ダッシュボードから、過去の変換をいつでも再開または削除する。
