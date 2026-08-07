import type { Metadata } from "next";
import { Public_Sans, Merriweather } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DiaPalace | Ghana retail POS",
  description: "A modern point-of-sale, inventory, and reconciliation system for DiaPalace in Ghana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${publicSans.variable} ${merriweather.variable}`}>
      <body>{children}</body>
    </html>
  );
}
