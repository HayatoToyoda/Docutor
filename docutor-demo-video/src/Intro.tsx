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

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = rise(frame, 4, 22);
  const line1 = rise(frame, 26);
  const line2 = rise(frame, 36);
  const sub = rise(frame, 56);
  const dog = rise(frame, 68, 24);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #FFFFFF 0%, #EDF2FA 70%, #E3EBF7 100%)",
        fontFamily,
      }}
    >
      {/* soft background accents */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `${COLORS.blue}14`,
          left: -180 + Math.sin(frame / 90) * 20,
          top: -260,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: `${COLORS.green}12`,
          right: -140,
          bottom: -220 + Math.cos(frame / 80) * 18,
          filter: "blur(40px)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 44,
          paddingBottom: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            opacity: logo,
            scale: String(0.85 + logo * 0.15),
          }}
        >
          <div
            style={{
              width: 116,
              height: 116,
              borderRadius: 28,
              backgroundColor: COLORS.blue,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              fontWeight: 900,
              boxShadow: "0 20px 50px rgba(37,99,235,0.35)",
            }}
          >
            D
          </div>
          <div style={{ fontSize: 108, fontWeight: 900, color: COLORS.blue }}>
            Docutor
          </div>
        </div>

        <div style={{ textAlign: "center", lineHeight: 1.16 }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: COLORS.ink,
              opacity: line1,
              translate: `0px ${(1 - line1) * 30}px`,
            }}
          >
            From document to
          </div>
          <div
            style={{
              fontSize: 118,
              fontWeight: 900,
              opacity: line2,
              translate: `0px ${(1 - line2) * 34}px`,
            }}
          >
            <span style={{ color: COLORS.blue }}>Structured</span>{" "}
            <span style={{ color: COLORS.green }}>Markdown</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 42,
            fontWeight: 500,
            color: COLORS.slate,
            opacity: sub,
            translate: `0px ${(1 - sub) * 24}px`,
          }}
        >
          散らかったドキュメントを、AIと人のレビューで知識資産に
        </div>
      </AbsoluteFill>

      {/* mascot avatar peeking bottom-right */}
      <div
        style={{
          position: "absolute",
          right: 120,
          bottom: 90,
          opacity: dog,
          scale: String(0.7 + dog * 0.3),
          transformOrigin: "50% 100%",
        }}
      >
        <MascotCrop
          sx={128}
          sy={175}
          sw={250}
          sh={250}
          bw={190}
          style={{
            borderRadius: "50%",
            border: "8px solid #FFFFFF",
            boxShadow: "0 18px 46px rgba(15,23,42,0.25)",
            backgroundColor: COLORS.cream,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
