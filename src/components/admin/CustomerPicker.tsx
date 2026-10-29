"use client";
import { useMemo, useState } from "react";

export interface PickerCustomer { id: string; name: string; phone: string | null; risk: boolean; riskNote: string | null }

/** Elegir un cliente registrado o crear uno nuevo sin salir de la reserva. */
export function CustomerPicker({ customers, canCreate, defaultCustomerId }: { customers: PickerCustomer[]; canCreate: boolean; defaultCustomerId?: string }) {
  const [mode, setMode] = useState<"existing" | "new">(canCreate && customers.length === 0 ? "new" : "existing");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(defaultCustomerId ?? "");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? customers.filter((c) => `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(t)) : customers;
    const sel = customers.find((c) => c.id === selected);
    return sel && !base.some((c) => c.id === sel.id) ? [sel, ...base] : base;
  }, [customers, q, selected]);
  const chosen = customers.find((c) => c.id === selected);

  return (
    <div className="space-y-3">
      <input type="hidden" name="customer_mode" value={mode} />
      {canCreate && (
        <div role="group" aria-label="Tipo de cliente" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={mode === "existing"} className={`chip ${mode === "existing" ? "chip-active" : ""}`} onClick={() => setMode("existing")}>Cliente registrado</button>
          <button type="button" aria-pressed={mode === "new"} className={`chip ${mode === "new" ? "chip-active" : ""}`} onClick={() => setMode("new")}>+ Cliente nuevo</button>
        </div>)}

      {mode === "existing" ? (
        customers.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Todavía no hay clientes registrados.</p> : (
          <div className="space-y-2">
            {customers.length > 6 && <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" aria-label="Buscar cliente" className="input" />}
            <label className="block">Cliente *
              <select name="customer_id" required value={selected} onChange={(e) => setSelected(e.target.value)} className="input">
                <option value="">Selecciona…</option>
                {list.map((c) => <option key={c.id} value={c.id}>{c.risk ? "⚠ " : ""}{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select></label>
            {chosen?.risk && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">Cliente marcado como de riesgo{chosen.riskNote ? `: ${chosen.riskNote}` : ""}.</p>}
          </div>)
      ) : (
        <div className="space-y-3 rounded-lg border border-[var(--color-line)] p-3">
          <label className="block">Nombre completo *<input name="new_full_name" required className="input" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>Teléfono<input name="new_phone" type="tel" className="input" /></label>
            <label>Correo<input name="new_email" type="email" className="input" /></label>
            <label>Tipo de identificación
              <select name="new_id_type" defaultValue="" className="input"><option value="">—</option><option value="cedula">Cédula</option><option value="passport">Pasaporte</option><option value="other">Otro</option></select></label>
            <label>Número de documento<input name="new_id_number" className="input" /></label>
            <label>País de residencia<input name="new_country" className="input" /></label>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Se guarda como cliente nuevo. Si el documento ya está registrado, se usa ese cliente en lugar de duplicarlo. Puedes completar licencia y demás datos después, en Clientes.</p>
        </div>)}
    </div>
  );
}
