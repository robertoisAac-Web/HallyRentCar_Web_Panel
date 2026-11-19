import Link from "next/link";
import { getPublicCompany, getPublicVehicle } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { Gallery } from "@/components/public/Gallery";
import { formatMoney, toCents } from "@/lib/money";
import { t } from "@/lib/i18n";

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pickup?: string; return?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [company, { lang }] = await Promise.all([getPublicCompany(), getPrefs()]);
  const v = company ? await getPublicVehicle(company.id, id) : null;

  if (!company || !v) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-10">
        <p className="empty">{t(lang, "veh.notFound")}</p>
        <Link href="/vehiculos" className="underline">
          {t(lang, "veh.back")}
        </Link>
      </div>
    );
  }

  const dates =
    sp.pickup && sp.return
      ? `&pickup=${encodeURIComponent(sp.pickup)}&return=${encodeURIComponent(sp.return)}`
      : "";
  const specs = [
    v.seats ? t(lang, "veh.seats", { n: v.seats }) : null,
    v.transmission ? t(lang, v.transmission === "automatic" ? "veh.automatic" : "veh.manual") : null,
    v.fuel_type,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-12 sm:px-8 md:py-16">
      <Link
        href="/vehiculos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
      >
        <span>←</span>
        <span>{t(lang, "veh.back")}</span>
      </Link>

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        <div className="reveal lg:col-span-7">
          <Gallery photos={v.photos} alt={`${v.make} ${v.model} ${v.year}`} empty={t(lang, "veh.photoSoon")} />
        </div>

        <div
          className="reveal space-y-6 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-xs sm:p-8 lg:col-span-5"
          style={{ animationDelay: "100ms" }}
        >
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
              {v.year}
            </span>
            <h1 className="pt-1 text-3xl font-bold tracking-tight text-[var(--color-ink)]">
              {v.make} {v.model}
            </h1>
          </div>

          <div className="border-y border-[var(--color-line)] py-4">
            <span className="block text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
              {t(lang, "veh.perDay")}
            </span>
            <span className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
              {formatMoney(toCents(v.daily_rate), v.currency)}
            </span>
          </div>

          {specs.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t(lang, "veh.specs")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {specs.map((s) => (
                  <li
                    key={s}
                    className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--color-ink)]"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {v.features.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t(lang, "veh.features")}
              </h2>
              <ul className="grid grid-cols-2 gap-2 text-sm text-[var(--color-muted)]">
                {v.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#229ed9]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {v.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted)]">
              {v.description}
            </p>
          )}

          <Link
            href={`/reservar?vehicle=${v.id}${dates}`}
            className="btn btn-primary w-full justify-center rounded-2xl py-3.5 text-sm"
          >
            {t(lang, "veh.requestThis")}
          </Link>
        </div>
      </div>
    </div>
  );
}
