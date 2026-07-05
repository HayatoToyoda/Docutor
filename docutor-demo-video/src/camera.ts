import { Easing, interpolate } from "remotion";
import { VIEW_H, VIEW_W } from "./theme";

export type CamKey = {
  frame: number;
  x: number; // focus point in image coordinates
  y: number;
  z: number; // zoom factor
};

const ease = Easing.bezier(0.55, 0.06, 0.19, 0.98);

export const getCamera = (frame: number, keys: CamKey[]) => {
  const frames = keys.map((k) => k.frame);
  const opts = {
    easing: ease,
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
  };
  const x = interpolate(frame, frames, keys.map((k) => k.x), opts);
  const y = interpolate(frame, frames, keys.map((k) => k.y), opts);
  const z = interpolate(frame, frames, keys.map((k) => k.z), opts);
  return {
    z,
    tx: VIEW_W / 2 - z * x,
    ty: VIEW_H / 2 - z * y,
  };
};
