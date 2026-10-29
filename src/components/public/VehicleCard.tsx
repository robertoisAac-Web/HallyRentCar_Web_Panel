import Link from "next/link";
import { formatMoney, toCents } from "@/lib/money";
import { t, type Lang } from "@/lib/i18n";
import type { PublicVehicle } from "@/server/services/public";

export function VehicleCard({ v, lang, query = "", index = 0 }: { v: PublicVehicle; lang: Lang; query?: string; index?: number }) {
  const specs = [
    v.seats ? t(lang, "veh.seats", { n: v.seats }) : null,
    v.transmission ? t(lang, v.transmission === "automatic" ? "veh.automatic" : "veh.manual") : null,
    v.fuel_type,
  ].filter(Boolean);
  return (
    <article className="reveal card-lift overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
      <Link href={`/vehiculos/${v.id}${query ? `?${query.replace(/^&/, "")}` : ""}`} aria-label={`${v.make} ${v.model} ${v.year}`}>
        {v.photos[0]
          ? <img src={v.photos[0]} alt={`${v.make} ${v.model} ${v.year}`} loading="lazy" className="h-52 w-full object-cover" />
          : <div className="flex h-52 items-center justify-center bg-[var(--color-brand-soft)] text-sm text-[var(--color-title)]">{t(lang, "veh.photoSoon")}</div>}
      </Link>
      <div className="space-y-3 p-5">
        <div><h3 className="text-lg font-semibold tracking-tight">{v.make} {v.model}</h3><p className="text-sm text-[var(--color-muted)]">{v.year}{specs.length ? ` · ${specs.join(" · ")}` : ""}</p></div>
        {v.features.length > 0 && <p className="text-sm text-[var(--color-muted)]">{v.features.slice(0, 4).join(" · ")}</p>}
        <div className="flex items-end justify-between gap-3">
          <p><span className="text-xl font-semibold">{formatMoney(toCents(v.daily_rate), v.currency)}</span><span className="text-sm text-[var(--color-muted)]"> / {t(lang, "veh.perDay")}</span></p>
          <Link href={`/reservar?vehicle=${v.id}${query}`} className="btn btn-primary btn-sm">{t(lang, "veh.request")}</Link>
        </div>
      </div>
    </article>
  );
}
