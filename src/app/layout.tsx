import type { Metadata } from "next";
import { Public_Sans, Merriweather } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { brand } from "@/lib/brand";
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
  metadataBase: new URL("https://diapalace.vercel.app"),
  title: brand.appTitle,
  description: brand.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: brand.favicon,
    apple: brand.appleTouchIcon,
  },
  openGraph: {
    title: brand.publicTitle,
    description: brand.description,
    siteName: brand.businessName,
    images: [{ url: brand.logo, width: 1080, height: 871, alt: `${brand.businessName} logo` }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${publicSans.variable} ${merriweather.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
