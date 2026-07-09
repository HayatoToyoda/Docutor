import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
