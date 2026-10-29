import Link from "next/link";
import { getPublicCompany, getPublicVehicle } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { Gallery } from "@/components/public/Gallery";
import { formatMoney, toCents } from "@/lib/money";
import { t } from "@/lib/i18n";

export default async function VehicleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pickup?: string; return?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [company, { lang }] = await Promise.all([getPublicCompany(), getPrefs()]);
  const v = company ? await getPublicVehicle(company.id, id) : null;
  if (!company || !v) return (<div className="mx-auto max-w-xl space-y-4 p-10"><p className="empty">{t(lang, "veh.notFound")}</p><Link href="/vehiculos" className="underline">{t(lang, "veh.back")}</Link></div>);
  const dates = sp.pickup && sp.return ? `&pickup=${encodeURIComponent(sp.pickup)}&return=${encodeURIComponent(sp.return)}` : "";
  const specs = [
    v.seats ? t(lang, "veh.seats", { n: v.seats }) : null,
    v.transmission ? t(lang, v.transmission === "automatic" ? "veh.automatic" : "veh.manual") : null, v.fuel_type,
  ].filter(Boolean) as string[];
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-10">
      <Link href="/vehiculos" className="text-sm underline">← {t(lang, "veh.back")}</Link>
      <div className="grid gap-8 md:grid-cols-5">
        <div className="reveal md:col-span-3"><Gallery photos={v.photos} alt={`${v.make} ${v.model} ${v.year}`} empty={t(lang, "veh.photoSoon")} /></div>
        <div className="reveal space-y-5 md:col-span-2" style={{ animationDelay: "100ms" }}>
          <div><h1 className="text-3xl font-semibold tracking-tight">{v.make} {v.model}</h1><p className="text-[var(--color-muted)]">{v.year}</p></div>
          <p><span className="text-3xl font-semibold">{formatMoney(toCents(v.daily_rate), v.currency)}</span><span className="text-[var(--color-muted)]"> / {t(lang, "veh.perDay")}</span></p>
          {specs.length > 0 && <div><h2 className="mb-2 text-sm font-semibold">{t(lang, "veh.specs")}</h2><ul className="flex flex-wrap gap-2">{specs.map((s) => <li key={s} className="chip">{s}</li>)}</ul></div>}
          {v.features.length > 0 && <div><h2 className="mb-2 text-sm font-semibold">{t(lang, "veh.features")}</h2><ul className="list-disc space-y-1 pl-5 text-sm">{v.features.map((f) => <li key={f}>{f}</li>)}</ul></div>}
          {v.description && <p className="whitespace-pre-wrap text-sm text-[var(--color-muted)]">{v.description}</p>}
          <Link href={`/reservar?vehicle=${v.id}${dates}`} className="btn btn-primary w-full justify-center">{t(lang, "veh.requestThis")}</Link>
        </div>
      </div>
    </div>
  );
}
