import Link from "next/link";
import { businessYmd } from "@/lib/dates";
import { DateRangeFields } from "@/components/ui/DateRangeFields";
import { getPublicCompanyStatus, getPublicVehicles } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { VehicleCard } from "@/components/public/VehicleCard";
import { whatsappLink } from "@/lib/whatsapp";
import { t } from "@/lib/i18n";

export default async function Home() {
  const [{ company, reason }, { lang }] = await Promise.all([getPublicCompanyStatus(), getPrefs()]);
  if (!company) return (
    <div className="mx-auto max-w-xl p-10">
      <h1 className="page-title">{t(lang, "site.soonTitle")}</h1><p className="page-sub">{t(lang, "site.soonSub")}</p>
      {process.env.NODE_ENV !== "production" && reason && (
        <p role="alert" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>Aviso para desarrollo:</strong> {reason}</p>)}
    </div>);
  const vehicles = await getPublicVehicles(company.id);
  const hero = vehicles.find((v) => v.photos[0])?.photos[0];
  const wa = whatsappLink(company.whatsapp_number, t(lang, "wa.hello"));
  const steps = [["home.step1t", "home.step1d"], ["home.step2t", "home.step2d"], ["home.step3t", "home.step3d"]] as const;
  return (
    <>
      <section className="hero-bg relative text-white">
        {hero && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img src={hero} alt="" className="h-full w-full object-cover opacity-25" />
          </div>
        )}
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div className="reveal space-y-5">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{company.tagline ?? t(lang, "home.heroDefault")}</h1>
            <p className="max-w-md text-lg text-white/80">{t(lang, "home.heroSub")}</p>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-secondary">{t(lang, "home.waBtn")}</a>}
          </div>
          <form action="/vehiculos" className="reveal space-y-4 rounded-2xl bg-surface p-6 text-[var(--color-ink)] shadow-2xl" style={{ animationDelay: "120ms" }}>
            <p className="text-lg font-semibold">{t(lang, "home.checkTitle")}</p>
            <DateRangeFields startName="pickup" endName="return" startLabel={t(lang, "home.pickup")} endLabel={t(lang, "home.return")} lang={lang} minStart={businessYmd(new Date())} />
            <button className="btn btn-primary w-full justify-center">{t(lang, "home.checkBtn")}</button>
          </form>
        </div>
      </section>
      <section className="mx-auto max-w-6xl space-y-6 px-5 py-14">
        <div className="flex items-end justify-between"><h2 className="text-2xl font-semibold tracking-tight">{t(lang, "home.ourVehicles")}</h2><Link href="/vehiculos" className="text-sm font-semibold underline">{t(lang, "home.viewAll")}</Link></div>
        {vehicles.length === 0 ? <p className="empty">{t(lang, "home.soonVehicles")}</p> :
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{vehicles.slice(0, 6).map((v, i) => <VehicleCard key={v.id} v={v} lang={lang} index={i} />)}</div>}
      </section>
      <section className="border-y border-[var(--color-line)] bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">{t(lang, "home.howTitle")}</h2>
          <ol className="grid gap-8 md:grid-cols-3">{steps.map(([title, desc], i) => (
            <li key={title} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0c1e2e] font-bold text-[#76e012] border border-[#76e012]/30 shadow-xs">{i + 1}</span>
              <div><h3 className="font-semibold">{t(lang, title)}</h3><p className="mt-1 text-sm text-[var(--color-muted)]">{t(lang, desc)}</p></div></li>))}</ol>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-14">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">{t(lang, "home.faqTitle")}</h2>
        <div className="faq divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {([["faq.q1", "faq.a1"], ["faq.q2", "faq.a2"]] as const).map(([q, a]) => (<details key={q}><summary>{t(lang, q)}</summary><p className="pb-4 text-sm text-[var(--color-muted)]">{t(lang, a)}</p></details>))}
          <details><summary>{t(lang, "faq.q3")}</summary>
            <p className="pb-4 text-sm text-[var(--color-muted)]">{company.delivery_zones ? t(lang, "faq.a3", { zones: company.delivery_zones }) : t(lang, "faq.a3none")}</p></details>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-16 text-sm">
        <h2 className="text-2xl font-semibold tracking-tight">{t(lang, "home.locTitle")}</h2>
        <p className="mt-2 text-[var(--color-muted)]">{company.address ?? t(lang, "home.addrTbd")}</p>
        <p className="mt-4"><Link href="/condiciones" className="font-semibold underline">{t(lang, "home.termsLink")}</Link></p>
      </section>
    </>
  );
}
