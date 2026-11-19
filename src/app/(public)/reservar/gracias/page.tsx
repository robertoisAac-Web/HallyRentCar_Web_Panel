import Link from "next/link";
import { getPublicCompany, getPublicVehicles } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { whatsappLink } from "@/lib/whatsapp";
import { t } from "@/lib/i18n";
import { WhatsAppAutoRedirect } from "@/components/public/WhatsAppAutoRedirect";

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    vehicle?: string;
    pickup?: string;
    return?: string;
    name?: string;
    phone?: string;
    pickup_location?: string;
    return_location?: string;
  }>;
}) {
  const sp = await searchParams;
  const [company, { lang }] = await Promise.all([getPublicCompany(), getPrefs()]);
  const code = sp.code && /^RC-\d{4}-\d{4,}$/.test(sp.code) ? sp.code : null;

  let vehicleName = "";
  if (company && sp.vehicle && /^[0-9a-f-]{36}$/.test(sp.vehicle)) {
    const [v] = await getPublicVehicles(company.id, [sp.vehicle]);
    if (v) vehicleName = `${v.make} ${v.model} ${v.year}`;
  }

  const pickupClean = sp.pickup && LOCAL.test(sp.pickup) ? sp.pickup.replace("T", " ") : "";
  const returnClean = sp.return && LOCAL.test(sp.return) ? sp.return.replace("T", " ") : "";

  const lines: string[] = [
    lang === "en"
      ? "🚗 *NEW WEB RESERVATION - HALLY RENT A CAR*"
      : "🚗 *NUEVA RESERVA WEB - HALLY RENT A CAR*",
  ];
  if (code) lines.push(`📋 *Código:* ${code}`);
  if (sp.name) lines.push(`👤 *Cliente:* ${sp.name}`);
  if (sp.phone) lines.push(`📞 *Teléfono:* ${sp.phone}`);
  if (vehicleName) lines.push(`🚘 *Vehículo:* ${vehicleName}`);
  if (pickupClean) {
    lines.push(
      `📅 *Recogida:* ${pickupClean}${sp.pickup_location ? ` (${sp.pickup_location})` : ""}`
    );
  }
  if (returnClean) {
    lines.push(
      `🏁 *Devolución:* ${returnClean}${sp.return_location ? ` (${sp.return_location})` : ""}`
    );
  }
  lines.push("");
  lines.push(
    lang === "en"
      ? "Hello! I just submitted this reservation on the website and would like to confirm availability."
      : "¡Hola! Acabo de registrar esta reserva en la página web y me gustaría confirmar los detalles."
  );

  const text = lines.join("\n");
  const wa = whatsappLink(company?.whatsapp_number, text);

  return (
    <div className="reveal mx-auto max-w-xl px-5 py-16">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 md:p-10 text-center shadow-[0_12px_40px_rgb(15,23,42,0.06)] space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {t(lang, "thx.title")}
          </h1>
          {code && (
            <p className="text-base text-slate-600">
              {t(lang, "thx.yourCode")}{" "}
              <span className="plate ml-1">{code}</span>
            </p>
          )}
        </div>

        {(vehicleName || pickupClean) && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-left text-xs text-slate-600 space-y-1.5">
            {sp.name && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 font-medium">Cliente:</span>
                <span className="font-semibold text-slate-800">{sp.name}</span>
              </div>
            )}
            {vehicleName && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 font-medium">Vehículo:</span>
                <span className="font-semibold text-slate-800">{vehicleName}</span>
              </div>
            )}
            {pickupClean && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 font-medium">Recogida:</span>
                <span className="font-semibold text-slate-800">{pickupClean}</span>
              </div>
            )}
            {returnClean && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 font-medium">Devolución:</span>
                <span className="font-semibold text-slate-800">{returnClean}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-slate-500 leading-relaxed">
          {t(lang, "thx.pending")}
        </p>

        {wa && (
          <div className="space-y-3 pt-1">
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-[#16a34a] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#15803d] transition-all"
            >
              <span>Enviar confirmación por WhatsApp ahora</span>
              <span aria-hidden="true">→</span>
            </a>
            <WhatsAppAutoRedirect waUrl={wa} />
            <p className="text-[11px] text-slate-400">{t(lang, "thx.waNote")}</p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <Link
            href="/"
            className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4"
          >
            {t(lang, "thx.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
