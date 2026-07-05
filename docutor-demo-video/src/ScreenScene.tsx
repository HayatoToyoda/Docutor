import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { CamKey, getCamera } from "./camera";
import { COLORS, fontFamily, IMG_H, IMG_W } from "./theme";

export type Highlight = {
  x: number;
  y: number;
  w: number;
  h: number;
  from: number;
  to?: number;
  color?: string;
};

export type CursorKey = { frame: number; x: number; y: number };
export type Click = { frame: number; x: number; y: number; color?: string };

const moveEase = Easing.bezier(0.5, 0.05, 0.25, 1);

const HighlightBox: React.FC<{ h: Highlight }> = ({ h }) => {
  const frame = useCurrentFrame();
  const color = h.color ?? COLORS.blue;
  const appear = interpolate(frame, [h.from, h.from + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const fadeOut =
    h.to === undefined
      ? 1
      : interpolate(frame, [h.to, h.to + 10], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const pulse = 0.75 + 0.25 * Math.sin((frame - h.from) / 6);
  return (
    <div
      style={{
        position: "absolute",
        left: h.x,
        top: h.y,
        width: h.w,
        height: h.h,
        borderRadius: 12,
        border: `3.5px solid ${color}`,
        backgroundColor: `${color}12`,
        boxShadow: `0 0 ${18 * pulse}px ${color}66`,
        opacity: appear * fadeOut,
        scale: String(1 + (1 - appear) * 0.05),
      }}
    />
  );
};

const ClickRipple: React.FC<{ c: Click }> = ({ c }) => {
  const frame = useCurrentFrame();
  if (frame < c.frame || frame > c.frame + 18) {
    return null;
  }
  const t = interpolate(frame, [c.frame, c.frame + 18], [0, 1], {
    easing: Easing.out(Easing.quad),
  });
  const r = 8 + t * 55;
  return (
    <div
      style={{
        position: "absolute",
        left: c.x - r,
        top: c.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: `4px solid ${c.color ?? COLORS.blue}`,
        opacity: 1 - t,
      }}
    />
  );
};

const Cursor: React.FC<{ path: CursorKey[]; clicks: Click[] }> = ({
  path,
  clicks,
}) => {
  const frame = useCurrentFrame();
  const frames = path.map((k) => k.frame);
  const opts = {
    easing: moveEase,
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
  };
  const x = interpolate(frame, frames, path.map((k) => k.x), opts);
  const y = interpolate(frame, frames, path.map((k) => k.y), opts);
  const appear = interpolate(
    frame,
    [path[0].frame - 8, path[0].frame + 4],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Dip the cursor on each click
  let dip = 1;
  for (const c of clicks) {
    if (Math.abs(frame - c.frame) <= 5) {
      dip = 1 - 0.18 * (1 - Math.abs(frame - c.frame) / 5);
    }
  }
  return (
    <>
      {clicks.map((c, i) => (
        <ClickRipple key={i} c={c} />
      ))}
      <svg
        width={40}
        height={44}
        viewBox="0 0 20 22"
        style={{
          position: "absolute",
          left: x,
          top: y,
          opacity: appear,
          scale: String(dip),
          transformOrigin: "3px 2px",
          filter: "drop-shadow(0 3px 6px rgba(15,23,42,0.45))",
        }}
      >
        <path
          d="M3 1 L3 16.5 L7.2 12.9 L9.8 18.9 L12.7 17.6 L10.1 11.8 L15.6 11.4 Z"
          fill="#0F172A"
          stroke="#FFFFFF"
          strokeWidth={1.4}
        />
      </svg>
    </>
  );
};

const LowerThird: React.FC<{ step: string; title: string; accent: string }> = ({
  step,
  title,
  accent,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [6, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        bottom: 96,
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "26px 44px 26px 30px",
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.94)",
        boxShadow: "0 24px 70px rgba(15,23,42,0.28)",
        opacity: enter,
        translate: `0px ${(1 - enter) * 40}px`,
        fontFamily,
      }}
    >
      <div
        style={{
          backgroundColor: accent,
          color: "#FFFFFF",
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: 2,
          padding: "12px 24px",
          borderRadius: 14,
          whiteSpace: "nowrap",
        }}
      >
        {step}
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 900,
          color: COLORS.ink,
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
    </div>
  );
};

export const ScreenScene: React.FC<{
  src: string;
  camera: CamKey[];
  highlights?: Highlight[];
  cursor?: CursorKey[];
  clicks?: Click[];
  step: string;
  title: string;
  accent?: string;
  children?: React.ReactNode; // extra overlays in image space
}> = ({
  src,
  camera,
  highlights = [],
  cursor,
  clicks = [],
  step,
  title,
  accent = COLORS.blue,
  children,
}) => {
  const frame = useCurrentFrame();
  const cam = getCamera(frame, camera);
  // Gentle handheld drift so holds never look frozen
  const driftX = Math.sin(frame / 47) * 3.5;
  const driftY = Math.cos(frame / 61) * 3;
  return (
    <AbsoluteFill
      style={{ background: "linear-gradient(135deg, #E8EDF6 0%, #DCE5F2 100%)" }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: IMG_W,
          height: IMG_H,
          translate: `${cam.tx + driftX}px ${cam.ty + driftY}px`,
          scale: String(cam.z),
          transformOrigin: "0 0",
        }}
      >
        <div
          style={{
            width: IMG_W,
            height: IMG_H,
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 50px 140px rgba(15,23,42,0.35)",
          }}
        >
          <Img
            src={staticFile(src)}
            style={{ width: IMG_W, height: IMG_H, display: "block" }}
          />
          {highlights.map((h, i) => (
            <HighlightBox key={i} h={h} />
          ))}
          {children}
          {cursor && cursor.length > 0 ? (
            <Cursor path={cursor} clicks={clicks} />
          ) : null}
        </div>
      </div>
      <LowerThird step={step} title={title} accent={accent} />
    </AbsoluteFill>
  );
};
