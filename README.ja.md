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

- 実際に変換を行う場合は **OpenAI APIキー** が必要です（`mock` プロバイダーはAPIキーなしで動作します）。

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

```bash
pnpm dev
```

その後、[http://localhost:3000](http://localhost:3000) を開いてください。

### 便利なスクリプト

- `pnpm dev` — Next.jsの開発サーバーを起動
- `pnpm build` — 本番ビルド
- `pnpm lint` — ESLintを実行
- `pnpm test` — Vitestによる単体テストスイートを実行

## コアプロダクトフロー

1. PowerPoint、Word、PDF、または図表の多いビジネス文書をアップロードする。
2. テキスト、画像、表、図表候補を抽出する。
3. 抽出したコンテンツを構造化されたMarkdownセクションに変換する。
4. 生成された各セクションをレビューする。
5. 元の図表キャプチャと生成されたMermaidまたはdraw.ioの出力を比較する。
6. 必要に応じて図表コードを編集し、結果をプレビューする。
7. レビュー済みのセクションを承認する。
8. レビューを完了する。
9. 最終的なMarkdownファイルと関連アセットをエクスポートする。

## MVPスコープ

MVPでは、完璧なドキュメント解析よりもレビュー体験を優先します。

必須の機能:

- ファイルアップロード
- モック変換パイプライン
- レビュー画面
- レビュー可能なセクション一覧
- Markdownエディタとプレビュー
- 図表比較UI
- Mermaidコードの編集とプレビュー
- 完了アクション
- Markdownエクスポート
- 関連アセットを含むZIPエクスポート

Office文書やPDFの解析は当初は部分的、あるいはモックでも構いませんが、
アーキテクチャは後から実際のパーサーやLLM/VLMプロバイダーを追加できる
ようにしておく必要があります。

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

draw.ioのサポートは当初プレースホルダーから始めても構いませんが、図表
インターフェースは、後からdiagrams.netのビューアーやエディタを統合できる
ように設計する必要があります。

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

## 変換モード

Docutorは2つの変換モードをサポートします:

- `mock`: APIキーなしで動作し、サンプルの変換済みドキュメントを返します。
- `real`: プロバイダーインターフェースを使用し、OpenAI、Anthropic、Gemini、
  または他のプロバイダーを後から切り替えられるようにします。

このアプリは特定のLLMプロバイダーにハードコードされるべきではありません。

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

## 予定している画面

1. アップロード画面
2. レビュー画面
3. 図表レビューコンポーネント
4. 完了・エクスポート画面

UIは、落ち着いていて、構造化されており、繰り返しのレビュー作業でも
一目で把握できる、静かなエンタープライズSaaSツールのように感じられる
べきです。

## 完了基準

MVPは、ユーザーが以下を行える時点で完了とします:

1. ファイルをアップロードする。
2. 変換されたモックドキュメントを取得する。
3. 生成されたセクションをレビューする。
4. 元の図表画像と生成されたMermaid図を比較する。
5. Mermaidコードを編集する。
6. 更新された図表をプレビューする。
7. セクションを承認する。
8. 「完了」をクリックする。
9. 最終的なMarkdownをダウンロードする。
