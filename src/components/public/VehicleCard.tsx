import Link from "next/link";
import { formatMoney, toCents } from "@/lib/money";
import { t, type Lang } from "@/lib/i18n";
import type { PublicVehicle } from "@/server/services/public";
import { ScrollReveal } from "./ScrollReveal";

export function VehicleCard({
  v,
  lang,
  query = "",
  index = 0,
}: {
  v: PublicVehicle;
  lang: Lang;
  query?: string;
  index?: number;
}) {
  const specs = [
    v.seats ? t(lang, "veh.seats", { n: v.seats }) : null,
    v.transmission ? t(lang, v.transmission === "automatic" ? "veh.automatic" : "veh.manual") : null,
    v.fuel_type,
  ].filter(Boolean) as string[];

  const detailHref = `/vehiculos/${v.id}${query ? `?${query.replace(/^&/, "")}` : ""}`;

  return (
    <ScrollReveal delay={Math.min(index, 6) * 65}>
      <article className="group card-lift relative flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)]">
        <Link
          href={detailHref}
          aria-label={`${v.make} ${v.model} ${v.year}`}
          className="relative block aspect-[16/10] w-full overflow-hidden bg-[var(--color-surface-muted)]"
        >
          {v.photos[0] ? (
            <img
              src={v.photos[0]}
              alt={`${v.make} ${v.model} ${v.year}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-[var(--color-muted)]">
              {t(lang, "veh.photoSoon")}
            </div>
          )}
          <span className="absolute top-3.5 left-3.5 rounded-full border border-black/5 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900 backdrop-blur-md shadow-2xs">
            {v.year}
          </span>
        </Link>

        <div className="flex flex-1 flex-col justify-between p-6">
          <div className="space-y-3">
            <Link href={detailHref} className="block">
              <h3 className="text-xl font-semibold tracking-tight text-[var(--color-ink)] transition-colors duration-200 group-hover:text-[#229ed9]">
                {v.make} {v.model}
              </h3>
            </Link>

            {specs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {specs.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {v.features.length > 0 && (
              <p className="line-clamp-1 text-xs text-[var(--color-muted)]">
                {v.features.slice(0, 4).join(" · ")}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-end justify-between gap-3 border-t border-[var(--color-line)] pt-4">
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                {t(lang, "veh.perDay")}
              </span>
              <span className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                {formatMoney(toCents(v.daily_rate), v.currency)}
              </span>
            </div>

            <Link
              href={`/reservar?vehicle=${v.id}${query}`}
              className="btn btn-primary btn-sm rounded-full px-4 py-2.5 text-xs font-semibold"
            >
              <span>{t(lang, "veh.request")}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </article>
    </ScrollReveal>
  );
}
