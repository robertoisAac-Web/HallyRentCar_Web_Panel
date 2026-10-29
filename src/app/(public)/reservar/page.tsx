import Link from "next/link";
import { getPublicCompany, getPublicVehicles, getFreeVehicleIds } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { RequestForm } from "@/components/public/RequestForm";
import { labelsFor, t } from "@/lib/i18n";
import { toCents } from "@/lib/money";
import { submitRequestAction } from "../actions";

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ vehicle?: string; pickup?: string; return?: string; error?: string }> }) {
  const sp = await searchParams;
  const [company, { lang }] = await Promise.all([getPublicCompany(), getPrefs()]);
  if (!company) return <div className="mx-auto max-w-xl p-10"><h1 className="page-title">{t(lang, "site.soonTitle")}</h1></div>;
  const freeIds = sp.pickup && sp.return ? await getFreeVehicleIds(company, sp.pickup, sp.return) : null;
  const vehicles = await getPublicVehicles(company.id, freeIds ?? undefined);
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-10">
      <div><h1 className="text-3xl font-semibold tracking-tight">{t(lang, "req.title")}</h1><p className="page-sub">{t(lang, "req.subtitle")}</p></div>
      {sp.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}
      {vehicles.length === 0 ? <p className="empty">{t(lang, "req.noVehicles")} <Link href="/vehiculos" className="font-semibold underline">{t(lang, "req.changeDates")}</Link></p> : (
        <RequestForm action={submitRequestAction} graceMinutes={company.grace_minutes} labels={labelsFor(lang, "req.")} lang={lang}
          defaults={{ vehicle: sp.vehicle, pickup: sp.pickup, ret: sp.return }}
          vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.make} ${v.model} ${v.year}`, rateCents: toCents(v.daily_rate), currency: v.currency }))} />)}
    </div>
  );
}
