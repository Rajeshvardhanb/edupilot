import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { PrefsScript } from "@/components/theme";
import { getInstitution } from "@/lib/institution";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Plus_Jakarta_Sans({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "EduPilot", template: "%s · EduPilot" },
  description: "College management system for Engineering & Diploma institutions",
};

/** The college's brand colour drives the gradient and the accent colour everywhere. */
async function brandCss() {
  let c = "#4f46e5";
  try {
    const inst = await getInstitution();
    if (inst && /^#[0-9a-f]{6}$/i.test(inst.brandColor)) c = inst.brandColor;
  } catch {
    // Database unreachable (e.g. during build): keep the default colour.
  }
  if (c.toLowerCase() === "#4f46e5") return "";
  return `:root{--brand-start:${c};--brand-end:color-mix(in oklab,${c} 65%,#a21caf);--brand:${c};--brand-soft:color-mix(in oklab,${c} 10%,white)}`;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const css = await brandCss();
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <head><PrefsScript />{css && <style dangerouslySetInnerHTML={{ __html: css }} />}</head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
