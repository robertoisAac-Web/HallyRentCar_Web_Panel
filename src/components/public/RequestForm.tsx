"use client";
import { useMemo, useState } from "react";
import { billableDays } from "@/lib/pricing";
import { parseBusinessLocal, isBusinessLocal } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { fmt, type Lang } from "@/lib/i18n";
import { addDays } from "@/lib/datepicker";
import { businessYmd } from "@/lib/dates";
import { DateTimePicker } from "@/components/ui/DateTimePicker";

export interface FormVehicle { id: string; label: string; rateCents: number; currency: "DOP" | "USD" }

/** El estimado usa la misma función de días facturables que el servidor; el importe final lo fija el servidor. */
export function RequestForm({ action, vehicles, graceMinutes, defaults, labels, lang }: {
  action: (fd: FormData) => void | Promise<void>; vehicles: FormVehicle[]; graceMinutes: number;
  defaults: { vehicle?: string; pickup?: string; ret?: string }; labels: Record<string, string>; lang: Lang;
}) {
  const [vehicleId, setVehicleId] = useState(defaults.vehicle ?? "");
  const [pickup, setPickup] = useState(defaults.pickup ?? "");
  const [ret, setRet] = useState(defaults.ret ?? "");
  const estimate = useMemo(() => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v || !isBusinessLocal(pickup) || !isBusinessLocal(ret)) return null;
    try {
      const days = billableDays(parseBusinessLocal(pickup), parseBusinessLocal(ret), graceMinutes);
      return { days, total: formatMoney(v.rateCents * days, v.currency) };
    } catch { return null; }
  }, [vehicleId, pickup, ret, vehicles, graceMinutes]);

  return (
    <form action={action} className="space-y-6">
      <div className="hidden" aria-hidden="true"><label>No llenar<input name="website_url" tabIndex={-1} autoComplete="off" /></label></div>
      <section className="panel space-y-4">
        <h2>{labels["req.vehicleDates"]}</h2>
        <label className="block">{labels["req.vehicle"]} *
          <select name="vehicle_id" required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="input">
            <option value="" disabled>{labels["req.select"]}</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimePicker name="pickup_local" label={labels["req.pickup"]} lang={lang} required value={pickup} min={businessYmd(new Date())} onChange={(v) => { setPickup(v); if (ret && ret <= v) setRet(addDays(v, 1)); }} />
          <DateTimePicker name="return_local" label={labels["req.return"]} lang={lang} required value={ret} min={pickup || businessYmd(new Date())} onChange={setRet} />
          <label>{labels["req.pickupLoc"]}<input name="pickup_location" placeholder={labels["req.pickupLocPh"]} className="input" /></label>
          <label>{labels["req.returnLoc"]}<input name="return_location" className="input" /></label>
        </div>
        <div aria-live="polite" className="rounded-xl bg-[var(--color-brand-soft)] p-4 text-sm">
          {estimate ? (<>
            <p className="font-semibold">{labels["req.estimate"]}: {fmt(labels["req.days"], { n: estimate.days })}</p>
            <p className="text-2xl font-semibold text-[var(--color-title)]">{estimate.total}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{labels["req.estNote"]}</p></>) : <p className="text-[var(--color-muted)]">{labels["req.pickDates"]}</p>}
        </div>
      </section>
      <section className="panel space-y-4">
        <h2>{labels["req.yourData"]}</h2>
        <label className="block">{labels["req.name"]} *<input name="name" required autoComplete="name" className="input" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>{labels["req.phone"]} *<input name="phone" type="tel" required autoComplete="tel" className="input" /></label>
          <label>{labels["req.email"]}<input name="email" type="email" autoComplete="email" className="input" /></label>
        </div>
        <label className="block">{labels["req.message"]}<textarea name="message" rows={3} className="input" /></label>
        <p className="text-xs text-[var(--color-muted)]">{labels["req.noDocs"]}</p>
      </section>
      <button className="btn btn-primary">{labels["req.submit"]}</button>
    </form>
  );
}
