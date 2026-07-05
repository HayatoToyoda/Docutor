import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Docutor",
  description: "Convert enterprise documents into agent-readable Markdown.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
