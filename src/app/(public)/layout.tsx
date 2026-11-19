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
    <div className="public-root flex min-h-screen flex-col selection:bg-[#229ed9]/15 selection:text-[#0b2347]" data-theme={theme}>
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]/85 backdrop-blur-xl transition-colors duration-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 transition-opacity duration-200 hover:opacity-80">
            <img
              src="/logo-public-dark.png"
              alt={company?.name ?? "Hally Rent a Car"}
              className="h-9 sm:h-11 w-auto public-logo-dark"
            />
            <img
              src="/logo-public-light.png"
              alt={company?.name ?? "Hally Rent a Car"}
              className="h-9 sm:h-11 w-auto public-logo-light"
            />
          </Link>

          <nav className="flex items-center gap-2 text-sm sm:gap-5">
            <Link
              href="/vehiculos"
              className="rounded-full px-3 py-1.5 font-medium text-[var(--color-muted)] transition-colors duration-200 hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]"
            >
              {t(lang, "nav.vehicles")}
            </Link>
            <Link
              href="/condiciones"
              className="hidden rounded-full px-3 py-1.5 font-medium text-[var(--color-muted)] transition-colors duration-200 hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] sm:inline-block"
            >
              {t(lang, "nav.terms")}
            </Link>
            <div className="flex items-center gap-2 pl-1">
              <LangToggle current={lang} label={t(lang, "a11y.lang")} />
              <ThemeToggle label={t(lang, "a11y.theme")} />
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm hidden rounded-full px-4 py-2 sm:inline-flex"
                >
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface-subtle)] text-[var(--color-ink)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 text-sm sm:px-8 md:grid-cols-3">
          <div className="space-y-3">
            <img
              src="/logo-public-dark.png"
              alt={company?.name ?? "Hally Rent a Car"}
              className="h-10 w-auto public-logo-dark"
            />
            <img
              src="/logo-public-light.png"
              alt={company?.name ?? "Hally Rent a Car"}
              className="h-10 w-auto public-logo-light"
            />
            <p className="max-w-xs text-xs leading-relaxed text-[var(--color-muted)]">
              {company?.tagline ?? "Alquiler de vehículos confiable, transparente y rápido en República Dominicana."}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              {t(lang, "footer.contact")}
            </p>
            <p className="text-[var(--color-muted)]">{company?.phone ?? t(lang, "footer.phoneTbd")}</p>
            <p className="text-[var(--color-muted)] leading-relaxed">{company?.address ?? t(lang, "footer.addressTbd")}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              {t(lang, "footer.zones")}
            </p>
            <p className="text-[var(--color-muted)] leading-relaxed">
              {company?.delivery_zones ?? t(lang, "footer.zonesTbd")}
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--color-line)] py-6 text-center text-xs text-[var(--color-muted)]">
          <span>Hally Rent a Car &copy; {new Date().getFullYear()} · Todos los derechos reservados.</span>
        </div>
      </footer>
      <WhatsAppFab href={wa} label={t(lang, "a11y.waFab")} />
    </div>
  );
}
