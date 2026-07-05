# Docutor デモ動画 (Remotion)

`mock-design-first/assets/demo-video/` のモック画面 4 枚とマスコットシートを素材に、
プロダクトフローを「動くデモ」として見せる 42 秒 / 1920×1080 / 30fps の動画です。

## 構成

| シーン | 内容 |
| --- | --- |
| Intro | ロゴ + 「From document to Structured Markdown」 |
| STEP 1 · CONVERT | アップロード → 変換進捗 (シマー/グロー演出) → 構造化プレビュー |
| STEP 2 · REVIEW | 原文図と構造化結果の Diff レビュー → Accept クリック |
| STEP 3 · VALIDATE | Source → Detected → Structured → Approved のトレーサビリティを横断パン |
| STEP 4 · EXPORT | 統計 → エクスポートパッケージ → Download .zip → プレビュー |
| Outro | マスコット + 「Ready for agents!」 |

各画面はカメラワーク(ズーム/パン)、アニメーションカーソル、クリックリップル、
ハイライト枠で動きを付けています。座標は 1672×941 の画像ピクセル座標系です。

## コマンド

```bash
cd docutor-demo-video
npm run dev                                    # Remotion Studio でプレビュー
npx remotion render DocutorDemo out/docutor-demo.mp4   # MP4 レンダリング
```

## 主要ファイル

- `src/DocutorDemo.tsx` — シーン構成・カメラキーフレーム・ハイライト/カーソル座標
- `src/ScreenScene.tsx` — スクリーンショット + カメラ + ハイライト + カーソル + ローワーサード
- `src/camera.ts` — カメラキーフレーム補間
- `src/Intro.tsx` / `src/Outro.tsx` — 前後のブランドシーン
- `src/Mascot.tsx` — マスコットシートのスプライト切り出し
- `public/` — `mock-design-first/assets/demo-video/` からコピーした素材

## 注意

テンプレートに Tailwind v4 が含まれるため、preflight の `img { max-width: 100% }` が
効きます。コンテナより大きい `<Img>` を置くときは `maxWidth: "none"` を明示してください
(`src/Mascot.tsx` 参照)。
