import "./globals.css";
import { cookies } from "next/headers";
import { Instrument_Sans } from "next/font/google";
import { resolveLang } from "@/lib/i18n";

const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
export const metadata = { title: "Hally Rent Car | Alquiler de vehículos" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = resolveLang((await cookies()).get("lang")?.value);
  return (<html lang={lang} className={ui.variable}><body className="min-h-screen antialiased">{children}</body></html>);
}
