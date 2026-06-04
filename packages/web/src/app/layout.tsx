import type { Metadata } from "next";
import { Anton, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

// Scoreboard display face for headlines + big numbers.
const anton = Anton({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

// Clean, slightly characterful grotesque for body + UI.
const hanken = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KickStake",
  description:
    "Create a football tournament sweepstake, share a link, and let the app run the draw and the prizes for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Matchday is dark-only; force the palette regardless of OS setting.
      className={`dark ${anton.variable} ${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-pitch min-h-full flex flex-col">{children}</body>
    </html>
  );
}
