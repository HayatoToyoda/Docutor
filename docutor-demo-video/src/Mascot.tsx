import React from "react";
import { Img, staticFile } from "remotion";
import { IMG_H, IMG_W } from "./theme";

// Crops one pose out of the mascot sprite sheet.
// (sx, sy, sw, sh) is the source region in image pixels, bw the displayed width.
export const MascotCrop: React.FC<{
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  bw: number;
  style?: React.CSSProperties;
}> = ({ sx, sy, sw, sh, bw, style }) => {
  const scale = bw / sw;
  return (
    <div
      style={{
        width: bw,
        height: sh * scale,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      <Img
        src={staticFile("05-french-bulldog-mascot-sheet.png")}
        style={{
          position: "absolute",
          width: IMG_W * scale,
          height: IMG_H * scale,
          maxWidth: "none",
          left: -sx * scale,
          top: -sy * scale,
        }}
      />
    </div>
  );
};
