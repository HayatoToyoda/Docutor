import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Intro } from "./Intro";
import { Outro } from "./Outro";
import { ScreenScene } from "./ScreenScene";
import { COLORS } from "./theme";

export const INTRO_D = 120;
export const S1_D = 280;
export const S2_D = 280;
export const S3_D = 250;
export const S4_D = 270;
export const OUTRO_D = 150;
export const FADE_D = 18;
export const SLIDE_D = 20;
export const TOTAL_D =
  INTRO_D + S1_D + S2_D + S3_D + S4_D + OUTRO_D - FADE_D * 2 - SLIDE_D * 3;

const WIDE = { x: 836, y: 470, z: 1.056 };

// Animated shimmer + glow over the static progress UI of screen 01
const ConvertProgressFx: React.FC = () => {
  const frame = useCurrentFrame();
  const active = frame >= 150 && frame <= 225;
  if (!active) {
    return null;
  }
  const sweep = interpolate(frame % 30, [0, 30], [-160, 460]);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 514,
          top: 473,
          width: 412,
          height: 15,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: sweep,
            top: 0,
            width: 120,
            height: 15,
            background:
              "linear-gradient(100deg, transparent, rgba(255,255,255,0.75), transparent)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 389,
          top: 417,
          width: 84,
          height: 84,
          borderRadius: "50%",
          boxShadow: `0 0 ${20 + pulse * 14}px rgba(37,99,235,0.55)`,
          opacity: 0.9,
        }}
      />
    </>
  );
};

export const DocutorDemo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={INTRO_D}>
        <Intro />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_D })}
      />

      {/* STEP 1 — Convert */}
      <TransitionSeries.Sequence durationInFrames={S1_D}>
        <ScreenScene
          src="01-convert-document.png"
          step="STEP 1 · CONVERT"
          title="アップロードして、AIが構造化"
          camera={[
            { frame: 0, ...WIDE },
            { frame: 45, ...WIDE },
            { frame: 80, x: 741, y: 235, z: 1.9 },
            { frame: 120, x: 741, y: 235, z: 1.9 },
            { frame: 150, x: 741, y: 460, z: 1.9 },
            { frame: 195, x: 741, y: 460, z: 1.9 },
            { frame: 230, x: 940, y: 705, z: 1.75 },
            { frame: 279, x: 945, y: 712, z: 1.8 },
          ]}
          highlights={[
            { x: 356, y: 150, w: 770, h: 160, from: 85, to: 140 },
            { x: 356, y: 393, w: 770, h: 130, from: 155, to: 215 },
            { x: 778, y: 596, w: 327, h: 57, from: 233, color: COLORS.blue },
            { x: 778, y: 666, w: 327, h: 57, from: 243, color: COLORS.blue },
            { x: 778, y: 736, w: 327, h: 57, from: 253, color: COLORS.green },
            { x: 778, y: 807, w: 327, h: 57, from: 263, color: COLORS.amber },
          ]}
          cursor={[
            { frame: 45, x: 620, y: 620 },
            { frame: 80, x: 900, y: 235 },
            { frame: 125, x: 700, y: 470 },
            { frame: 160, x: 905, y: 481 },
            { frame: 215, x: 900, y: 700 },
            { frame: 240, x: 940, y: 833 },
          ]}
          clicks={[
            { frame: 86, x: 900, y: 235 },
            { frame: 246, x: 940, y: 833, color: COLORS.amber },
          ]}
        >
          <ConvertProgressFx />
        </ScreenScene>
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: SLIDE_D })}
      />

      {/* STEP 2 — Diff review */}
      <TransitionSeries.Sequence durationInFrames={S2_D}>
        <ScreenScene
          src="02-diff-review.png"
          step="STEP 2 · REVIEW"
          title="原文と並べて差分をレビュー"
          camera={[
            { frame: 0, ...WIDE },
            { frame: 40, ...WIDE },
            { frame: 75, x: 604, y: 470, z: 1.7 },
            { frame: 115, x: 604, y: 470, z: 1.7 },
            { frame: 150, x: 1422, y: 440, z: 1.7 },
            { frame: 205, x: 1422, y: 470, z: 1.7 },
            { frame: 240, x: 1300, y: 780, z: 1.62 },
            { frame: 279, x: 1300, y: 782, z: 1.64 },
          ]}
          highlights={[
            { x: 333, y: 172, w: 542, h: 613, from: 80, to: 140 },
            { x: 1218, y: 228, w: 410, h: 64, from: 160, to: 232 },
            {
              x: 1218,
              y: 368,
              w: 410,
              h: 64,
              from: 175,
              to: 232,
              color: COLORS.amber,
            },
            {
              x: 1218,
              y: 716,
              w: 410,
              h: 88,
              from: 190,
              to: 232,
              color: COLORS.amber,
            },
            { x: 1196, y: 848, w: 328, h: 62, from: 252, color: COLORS.green },
          ]}
          cursor={[
            { frame: 115, x: 830, y: 600 },
            { frame: 155, x: 1420, y: 300 },
            { frame: 195, x: 1420, y: 560 },
            { frame: 235, x: 1360, y: 878 },
          ]}
          clicks={[{ frame: 252, x: 1360, y: 878, color: COLORS.green }]}
          accent={COLORS.blue}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: SLIDE_D })}
      />

      {/* STEP 3 — Validation */}
      <TransitionSeries.Sequence durationInFrames={S3_D}>
        <ScreenScene
          src="03-validation-traceability.png"
          step="STEP 3 · VALIDATE"
          title="全項目が原文にトレース可能"
          accent={COLORS.green}
          camera={[
            { frame: 0, ...WIDE },
            { frame: 40, ...WIDE },
            { frame: 70, x: 520, y: 380, z: 1.8 },
            { frame: 110, x: 860, y: 380, z: 1.8 },
            { frame: 150, x: 1240, y: 380, z: 1.8 },
            { frame: 190, x: 1450, y: 380, z: 1.6 },
            { frame: 228, ...WIDE },
            { frame: 249, ...WIDE },
          ]}
          highlights={[
            { x: 376, y: 250, w: 245, h: 250, from: 72, to: 105 },
            { x: 692, y: 250, w: 300, h: 240, from: 108, to: 145 },
            {
              x: 1076,
              y: 250,
              w: 330,
              h: 245,
              from: 148,
              to: 185,
              color: COLORS.blue,
            },
            { x: 1440, y: 283, w: 150, h: 36, from: 192, color: COLORS.green },
            { x: 1440, y: 532, w: 150, h: 36, from: 200, color: COLORS.green },
            { x: 1440, y: 678, w: 150, h: 36, from: 208, color: COLORS.green },
            { x: 1425, y: 800, w: 205, h: 36, from: 216, color: COLORS.amber },
          ]}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: SLIDE_D })}
      />

      {/* STEP 4 — Export */}
      <TransitionSeries.Sequence durationInFrames={S4_D}>
        <ScreenScene
          src="04-export-complete.png"
          step="STEP 4 · EXPORT"
          title="エージェント対応の資産として出力"
          accent={COLORS.green}
          camera={[
            { frame: 0, ...WIDE },
            { frame: 40, ...WIDE },
            { frame: 70, x: 665, y: 340, z: 1.7 },
            { frame: 110, x: 665, y: 340, z: 1.7 },
            { frame: 140, x: 660, y: 620, z: 1.7 },
            { frame: 185, x: 660, y: 620, z: 1.7 },
            { frame: 212, x: 880, y: 500, z: 1.8 },
            { frame: 238, x: 1230, y: 440, z: 1.4 },
            { frame: 269, x: 1230, y: 445, z: 1.42 },
          ]}
          highlights={[
            { x: 300, y: 278, w: 178, h: 120, from: 74, to: 130, color: COLORS.green },
            { x: 484, y: 278, w: 174, h: 120, from: 82, to: 130, color: COLORS.green },
            { x: 662, y: 278, w: 174, h: 120, from: 90, to: 130, color: COLORS.amber },
            { x: 840, y: 278, w: 178, h: 120, from: 98, to: 130, color: COLORS.blue },
            { x: 330, y: 510, w: 660, h: 50, from: 148, to: 205 },
            { x: 330, y: 616, w: 660, h: 50, from: 158, to: 205 },
            { x: 330, y: 670, w: 660, h: 50, from: 168, to: 205 },
            { x: 845, y: 432, w: 152, h: 42, from: 214, color: COLORS.green },
            { x: 1450, y: 400, w: 195, h: 85, from: 248, color: COLORS.green },
          ]}
          cursor={[
            { frame: 115, x: 700, y: 350 },
            { frame: 150, x: 700, y: 610 },
            { frame: 205, x: 920, y: 453 },
          ]}
          clicks={[{ frame: 214, x: 920, y: 453, color: COLORS.green }]}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_D })}
      />

      <TransitionSeries.Sequence durationInFrames={OUTRO_D}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
