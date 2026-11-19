import Link from "next/link";
import { businessYmd } from "@/lib/dates";
import { DateRangeFields } from "@/components/ui/DateRangeFields";
import { getPublicCompanyStatus, getPublicVehicles } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { VehicleCard } from "@/components/public/VehicleCard";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { whatsappLink } from "@/lib/whatsapp";
import { t } from "@/lib/i18n";

export default async function Home() {
  const [{ company, reason }, { lang }] = await Promise.all([getPublicCompanyStatus(), getPrefs()]);

  if (!company) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <h1 className="page-title">{t(lang, "site.soonTitle")}</h1>
        <p className="page-sub">{t(lang, "site.soonSub")}</p>
        {process.env.NODE_ENV !== "production" && reason && (
          <p role="alert" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Aviso para desarrollo:</strong> {reason}
          </p>
        )}
      </div>
    );
  }

  const vehicles = await getPublicVehicles(company.id);
  const wa = whatsappLink(company.whatsapp_number, t(lang, "wa.hello"));
  const steps = [
    ["home.step1t", "home.step1d"],
    ["home.step2t", "home.step2d"],
    ["home.step3t", "home.step3d"],
  ] as const;

  return (
    <>
      {/* Hero Section Minimalista y Tipográfico (Sin imagen borrosa de fondo) */}
      <section className="hero-bg relative border-b border-[var(--color-line)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-12 lg:items-center lg:gap-14">
          <div className="reveal space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-subtle)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-muted)] shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-[#229ed9]" />
              <span>{company.delivery_zones ?? "Santo Domingo · Aeropuerto Las Américas"}</span>
            </div>

            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
              {company.tagline ?? t(lang, "home.heroDefault")}
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
              {t(lang, "home.heroSub")}
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link href="/vehiculos" className="btn btn-primary rounded-full px-6 py-3 text-sm">
                <span>{t(lang, "home.viewAll")}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary rounded-full px-6 py-3 text-sm"
                >
                  <span>{t(lang, "home.waBtn")}</span>
                </a>
              )}
            </div>
          </div>

          <div className="reveal lg:col-span-5" style={{ animationDelay: "110ms" }}>
            <form
              action="/vehiculos"
              className="space-y-5 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-[var(--color-ink)] shadow-[0_24px_48px_-16px_rgba(15,23,42,0.08)] sm:p-8"
            >
              <div className="space-y-1">
                <p className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
                  {t(lang, "home.checkTitle")}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {t(lang, "cat.subPrompt")}
                </p>
              </div>
              <DateRangeFields
                startName="pickup"
                endName="return"
                startLabel={t(lang, "home.pickup")}
                endLabel={t(lang, "home.return")}
                lang={lang}
                minStart={businessYmd(new Date())}
              />
              <button className="btn btn-primary w-full justify-center rounded-2xl py-3 text-sm">
                {t(lang, "home.checkBtn")}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Catálogo Destacado */}
      <section className="mx-auto max-w-6xl space-y-10 px-5 py-20 sm:px-8 md:py-24">
        <ScrollReveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#229ed9]">
                Flota Disponible
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl">
                {t(lang, "home.ourVehicles")}
              </h2>
            </div>
            <Link
              href="/vehiculos"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:text-[#229ed9]"
            >
              <span>{t(lang, "home.viewAll")}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </ScrollReveal>

        {vehicles.length === 0 ? (
          <p className="empty">{t(lang, "home.soonVehicles")}</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.slice(0, 6).map((v, i) => (
              <VehicleCard key={v.id} v={v} lang={lang} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Cómo Funciona */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-surface-subtle)]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-24">
          <ScrollReveal>
            <div className="mb-12 max-w-xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#229ed9]">
                Proceso Simple
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
                {t(lang, "home.howTitle")}
              </h2>
            </div>
          </ScrollReveal>

          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map(([title, desc], i) => (
              <ScrollReveal key={title} delay={i * 80}>
                <li className="flex h-full flex-col justify-between rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-2xs transition-colors hover:border-slate-300">
                  <span className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-sm font-bold text-[var(--color-ink)]">
                    0{i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
                      {t(lang, title)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                      {t(lang, desc)}
                    </p>
                  </div>
                </li>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Preguntas Frecuentes */}
      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 md:py-24">
        <ScrollReveal>
          <h2 className="mb-8 text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {t(lang, "home.faqTitle")}
          </h2>
          <div className="faq divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {([
              ["faq.q1", "faq.a1"],
              ["faq.q2", "faq.a2"],
            ] as const).map(([q, a]) => (
              <details key={q}>
                <summary>{t(lang, q)}</summary>
                <p className="pb-5 text-sm leading-relaxed text-[var(--color-muted)]">{t(lang, a)}</p>
              </details>
            ))}
            <details>
              <summary>{t(lang, "faq.q3")}</summary>
              <p className="pb-5 text-sm leading-relaxed text-[var(--color-muted)]">
                {company.delivery_zones
                  ? t(lang, "faq.a3", { zones: company.delivery_zones })
                  : t(lang, "faq.a3none")}
              </p>
            </details>
          </div>
        </ScrollReveal>
      </section>

      {/* Ubicación y Condiciones */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <ScrollReveal>
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-8 sm:flex-row sm:items-center sm:p-10">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                {t(lang, "home.locTitle")}
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                {company.address ?? t(lang, "home.addrTbd")}
              </p>
            </div>
            <Link
              href="/condiciones"
              className="btn btn-secondary rounded-full px-5 py-2.5 text-xs font-semibold"
            >
              {t(lang, "home.termsLink")} →
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
