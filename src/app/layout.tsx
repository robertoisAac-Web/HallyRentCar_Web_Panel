import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Instrument_Sans } from "next/font/google";
import { resolveLang } from "@/lib/i18n";
import { PwaInitializer } from "@/components/pwa/DesktopAppManager";

const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: "HallyRentCar · Panel Administrativo",
  applicationName: "HallyRentCar",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HallyRentCar",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon.png?v=2", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.ico?v=2"],
    apple: [{ url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2347",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = resolveLang((await cookies()).get("lang")?.value);
  return (
    <html lang={lang} className={ui.variable}>
      <body className="min-h-screen antialiased">
        <PwaInitializer />
        {children}
      </body>
    </html>
  );
}
