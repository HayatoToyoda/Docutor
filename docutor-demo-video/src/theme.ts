import { loadFont } from "@remotion/google-fonts/NotoSansJP";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "700", "900"],
  subsets: ["latin", "japanese"],
});

export const COLORS = {
  blue: "#2563EB",
  blueDark: "#1D4ED8",
  green: "#16A34A",
  amber: "#F59E0B",
  ink: "#0F172A",
  slate: "#64748B",
  bg: "#F1F5F9",
  card: "#FFFFFF",
  cream: "#F9F8F7",
};

export const IMG_W = 1672;
export const IMG_H = 941;
export const VIEW_W = 1920;
export const VIEW_H = 1080;
