import { getPublicCompany, getPublicVehicles, getFreeVehicleIds } from "@/server/services/public";
import { businessYmd } from "@/lib/dates";
import { DateRangeFields } from "@/components/ui/DateRangeFields";
import { getPrefs } from "@/server/public-prefs";
import { CatalogGrid } from "@/components/public/CatalogGrid";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { labelsFor, t } from "@/lib/i18n";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ pickup?: string; return?: string }>;
}) {
  const sp = await searchParams;
  const [company, { lang }] = await Promise.all([getPublicCompany(), getPrefs()]);
  if (!company) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <h1 className="page-title">{t(lang, "site.soonTitle")}</h1>
      </div>
    );
  }

  const freeIds = sp.pickup && sp.return ? await getFreeVehicleIds(company, sp.pickup, sp.return) : null;
  const vehicles = await getPublicVehicles(company.id, freeIds ?? undefined);
  const filtered = freeIds !== null;
  const query = filtered ? `&pickup=${encodeURIComponent(sp.pickup!)}&return=${encodeURIComponent(sp.return!)}` : "";

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 md:py-20">
      <ScrollReveal>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#229ed9]">
            Catálogo
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl">
            {t(lang, "cat.title")}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            {filtered
              ? t(lang, "cat.subFiltered", {
                  from: sp.pickup!.replace("T", " "),
                  to: sp.return!.replace("T", " "),
                })
              : t(lang, "cat.subPrompt")}
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={70}>
        <form className="flex flex-wrap items-end gap-4 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-5 sm:p-6">
          <DateRangeFields
            startName="pickup"
            endName="return"
            startLabel={t(lang, "home.pickup")}
            endLabel={t(lang, "home.return")}
            lang={lang}
            defaultStart={sp.pickup}
            defaultEnd={sp.return}
            minStart={businessYmd(new Date())}
          />
          <button className="btn btn-primary rounded-2xl px-6 py-2.5">
            {t(lang, "cat.check")}
          </button>
        </form>
      </ScrollReveal>

      {sp.pickup && sp.return && !filtered && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {t(lang, "cat.badDates")}
        </p>
      )}

      {vehicles.length === 0 ? (
        <p className="empty">{filtered ? t(lang, "cat.noneFiltered") : t(lang, "cat.none")}</p>
      ) : (
        <CatalogGrid vehicles={vehicles} lang={lang} query={query} labels={labelsFor(lang, "cat.")} />
      )}
    </div>
  );
}
