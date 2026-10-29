import Link from "next/link";
import { getPublicCompany, getPublicVehicles } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { whatsappLink } from "@/lib/whatsapp";
import { t } from "@/lib/i18n";

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ code?: string; vehicle?: string; pickup?: string; return?: string }> }) {
  const sp = await searchParams;
  const [company, { lang }] = await Promise.all([getPublicCompany(), getPrefs()]);
  const code = sp.code && /^RC-\d{4}-\d{4,}$/.test(sp.code) ? sp.code : null;
  let vehicleName = "";
  if (company && sp.vehicle && /^[0-9a-f-]{36}$/.test(sp.vehicle)) { const [v] = await getPublicVehicles(company.id, [sp.vehicle]); if (v) vehicleName = `${v.make} ${v.model} ${v.year}`; }
  const dates = sp.pickup && sp.return && LOCAL.test(sp.pickup) && LOCAL.test(sp.return) ? t(lang, "thx.dates", { from: sp.pickup.replace("T", " "), to: sp.return.replace("T", " ") }) : "";
  const text = code ? t(lang, "thx.waText", { code, vehicle: vehicleName ? t(lang, "thx.forVehicle", { vehicle: vehicleName }) : "", dates }) : t(lang, "thx.waTextNoCode");
  const wa = whatsappLink(company?.whatsapp_number, text);
  return (
    <div className="reveal mx-auto max-w-xl space-y-5 px-5 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "thx.title")}</h1>
      {code && <p className="text-lg">{t(lang, "thx.yourCode")} <span className="plate">{code}</span></p>}
      <p className="text-[var(--color-muted)]">{t(lang, "thx.pending")}</p>
      {wa && <p><a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary">{t(lang, "thx.wa")}</a></p>}
      {wa && <p className="text-xs text-[var(--color-muted)]">{t(lang, "thx.waNote")}</p>}
      <p><Link href="/" className="text-sm underline">{t(lang, "thx.home")}</Link></p>
    </div>
  );
}
