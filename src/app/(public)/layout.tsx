import Link from "next/link";
import type { Metadata } from "next";
import { getPublicCompany } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { whatsappLink } from "@/lib/whatsapp";
import { t } from "@/lib/i18n";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { LangToggle } from "@/components/public/LangToggle";
import { WhatsAppFab } from "@/components/public/WhatsAppFab";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getPublicCompany();
  const name = company?.name ?? "HallyRentCar";
  return {
    title: `${name} · Alquiler de Vehículos`,
    description: company?.tagline ?? `${name} · Santo Domingo, República Dominicana`,
    openGraph: { title: name, description: company?.tagline ?? undefined },
  };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [company, { lang, theme }] = await Promise.all([getPublicCompany(), getPrefs()]);
  const wa = whatsappLink(company?.whatsapp_number, t(lang, "wa.hello"));

  return (
    <div className="public-root flex min-h-screen flex-col" data-theme={theme}>
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img
              src="/logo-dark.png"
              alt={company?.name ?? "HallyRentCar"}
              className="h-7 md:h-8 w-auto public-logo-dark"
            />
            <img
              src="/logo.png"
              alt={company?.name ?? "HallyRentCar"}
              className="h-7 md:h-8 w-auto public-logo-light"
            />
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-4">
            <Link href="/vehiculos" className="hover:underline font-medium">{t(lang, "nav.vehicles")}</Link>
            <Link href="/condiciones" className="hidden hover:underline sm:inline font-medium">{t(lang, "nav.terms")}</Link>
            <LangToggle current={lang} label={t(lang, "a11y.lang")} />
            <ThemeToggle label={t(lang, "a11y.theme")} />
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm hidden sm:inline-flex">WhatsApp</a>}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-brand-dark text-white border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 text-sm md:grid-cols-3">
          <div>
            <img src="/logo.png" alt={company?.name ?? "HallyRentCar"} className="h-8 w-auto mb-3" />
            <p className="text-white/70 text-xs leading-relaxed max-w-xs">{company?.tagline ?? "Alquiler de vehículos confiable y rápido en República Dominicana."}</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">{t(lang, "footer.contact")}</p>
            <p className="text-white/70">{company?.phone ?? t(lang, "footer.phoneTbd")}</p>
            <p className="mt-1 text-white/70">{company?.address ?? t(lang, "footer.addressTbd")}</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">{t(lang, "footer.zones")}</p>
            <p className="text-white/70 leading-relaxed">{company?.delivery_zones ?? t(lang, "footer.zonesTbd")}</p>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          <span>HallyRentCar &copy; {new Date().getFullYear()} · Todos los derechos reservados.</span>
        </div>
      </footer>
      <WhatsAppFab href={wa} label={t(lang, "a11y.waFab")} />
    </div>
  );
}
