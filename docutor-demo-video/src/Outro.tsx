import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { MascotCrop } from "./Mascot";
import { COLORS, fontFamily } from "./theme";

const rise = (frame: number, from: number, len = 18) =>
  interpolate(frame, [from, from + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const dog = rise(frame, 6, 26);
  const logo = rise(frame, 18);
  const line = rise(frame, 30);
  const badge = interpolate(frame, [46, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const tags = rise(frame, 66, 22);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream, fontFamily }}>
      {/* mascot with raised paw, blended into matching background */}
      <div
        style={{
          position: "absolute",
          right: 110,
          bottom: 0,
          opacity: dog,
          translate: `0px ${(1 - dog) * 60}px`,
        }}
      >
        <MascotCrop sx={1180} sy={100} sw={492} sh={841} bw={560} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 150,
          top: 250,
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            opacity: logo,
            translate: `0px ${(1 - logo) * 26}px`,
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 22,
              backgroundColor: COLORS.blue,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 900,
              boxShadow: "0 16px 40px rgba(37,99,235,0.3)",
            }}
          >
            D
          </div>
          <div style={{ fontSize: 84, fontWeight: 900, color: COLORS.blue }}>
            Docutor
          </div>
        </div>

        <div
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: COLORS.ink,
            lineHeight: 1.25,
            opacity: line,
            translate: `0px ${(1 - line) * 26}px`,
          }}
        >
          レビュー済みの構造化Markdownを、
          <br />
          そのままAIエージェントへ。
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: badge,
            scale: String(0.7 + badge * 0.3),
            transformOrigin: "0% 50%",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              backgroundColor: COLORS.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 14px 36px rgba(22,163,74,0.35)",
            }}
          >
            <svg width={40} height={40} viewBox="0 0 24 24">
              <path
                d="M5 12.5 L10 17.5 L19 7.5"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, color: COLORS.green }}>
            Ready for agents!
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            opacity: tags,
            translate: `0px ${(1 - tags) * 20}px`,
          }}
        >
          {["Traceable", "Reviewed", "Structured", "Agent-ready"].map((t) => (
            <div
              key={t}
              style={{
                padding: "12px 26px",
                borderRadius: 999,
                backgroundColor: "#FFFFFF",
                border: "2px solid #E2E8F0",
                color: COLORS.slate,
                fontSize: 30,
                fontWeight: 700,
                boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
