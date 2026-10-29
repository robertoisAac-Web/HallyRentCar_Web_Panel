import { getReservationFinance } from "@/server/services/finance";
import { formatBusinessDateTime } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { DEPOSIT_STATUS_LABEL } from "@/lib/finance";
import { METHOD_LABEL } from "@/lib/validators/finance";
import { Badge } from "./ui";
import { createPaymentAction, createChargeAction, createDepositAction, voidAction } from "@/app/admin/reservas/finance-actions";

const KIND: Record<string, string> = { advance: "Anticipo", payment: "Pago", refund: "Reembolso", received: "Depósito recibido", returned: "Depósito devuelto", applied: "Deducción aplicada" };
const methodLabel = (m: string | null) => (m ? METHOD_LABEL[m as keyof typeof METHOD_LABEL] ?? m : "—");

function VoidForm({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs underline">Anular…</summary>
      <form action={action} className="mt-2 flex gap-2">
        <input name="reason" required minLength={3} placeholder="Motivo" className="input" />
        <button className="btn btn-danger btn-sm">Confirmar</button>
      </form>
    </details>
  );
}

export async function FinanceSections({ reservationId, total, depositRequired, currency, canWrite, canVoid }: {
  reservationId: string; total: string; depositRequired: string; currency: "DOP" | "USD"; canWrite: boolean; canVoid: boolean;
}) {
  const f = await getReservationFinance(reservationId, total, depositRequired);
  const m = (c: number) => formatMoney(c, currency);
  const dm = (a: string) => formatMoney(toCents(a), currency);
  const b = f.balance, d = f.deposit;
  return (
    <>
      <section className="panel space-y-4">
        <h2>Pagos</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-[var(--color-muted)]">A pagar</dt><dd className="font-semibold">{m(b.due)}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Cobrado (neto)</dt><dd className="font-semibold">{m(b.netReceived)}</dd></div>
          <div><dt className="text-[var(--color-muted)]">{b.balance < 0 ? "Saldo a favor del cliente" : "Saldo pendiente"}</dt><dd className="font-semibold">{m(Math.abs(b.balance))}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Cargos adicionales</dt><dd className="font-semibold">{m(b.chargesTotal)}</dd></div>
        </dl>
        {f.payments.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Todavía no hay pagos registrados.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Método</th><th>Referencia</th><th>Importe</th><th></th></tr></thead>
            <tbody>{f.payments.map((p) => (
              <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                <td>{formatBusinessDateTime(p.paid_at)}</td><td>{KIND[p.kind]}{p.voided_at && <> <Badge tone="red">Anulado</Badge></>}</td>
                <td>{methodLabel(p.method)}</td><td>{p.reference ?? "—"}</td>
                <td>{p.kind === "refund" ? "-" : ""}{dm(p.amount)}</td>
                <td>{canVoid && !p.voided_at && <VoidForm action={voidAction.bind(null, reservationId, "payments", p.id)} />}{p.void_reason && <span className="text-xs">{p.void_reason}</span>}</td>
              </tr>))}</tbody></table></div>)}
        {f.charges.length > 0 && (
          <ul className="space-y-1 text-sm">{f.charges.map((c) => (
            <li key={c.id} className={`flex items-center justify-between gap-3 ${c.voided_at ? "opacity-50 line-through" : ""}`}>
              <span>Cargo: {c.description} · {dm(c.amount)}</span>
              {canVoid && !c.voided_at && <VoidForm action={voidAction.bind(null, reservationId, "reservation_charges", c.id)} />}
            </li>))}</ul>)}
        {canWrite && (
          <div className="grid gap-4 md:grid-cols-2">
            <form action={createPaymentAction.bind(null, reservationId)} className="space-y-3 rounded-lg border border-[var(--color-line)] p-3">
              <p className="text-sm font-semibold">Registrar pago</p>
              <div className="grid grid-cols-2 gap-3">
                <label>Tipo<select name="kind" className="input"><option value="advance">Anticipo</option><option value="payment">Pago</option>{canVoid && <option value="refund">Reembolso</option>}</select></label>
                <label>Método<select name="method" className="input">{Object.entries(METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label>Importe *<input name="amount" required inputMode="decimal" className="input" /></label>
                <label>Referencia<input name="reference" placeholder="Obligatoria si no es efectivo" className="input" /></label>
              </div>
              <button className="btn btn-primary">Registrar pago</button>
            </form>
            <form action={createChargeAction.bind(null, reservationId)} className="space-y-3 rounded-lg border border-[var(--color-line)] p-3">
              <p className="text-sm font-semibold">Agregar cargo adicional</p>
              <label className="block">Descripción *<input name="description" required placeholder="Ej: día extra, limpieza" className="input" /></label>
              <label className="block">Importe *<input name="amount" required inputMode="decimal" className="input" /></label>
              <button className="btn btn-secondary">Agregar cargo</button>
            </form>
          </div>)}
      </section>

      <section className="panel space-y-4">
        <div className="flex items-center justify-between"><h2>Depósito en garantía</h2><Badge tone={d.status === "held" ? "blue" : d.status === "pending" ? "amber" : "gray"}>{DEPOSIT_STATUS_LABEL[d.status]}</Badge></div>
        <p className="text-xs text-[var(--color-muted)]">El depósito no es ingreso del alquiler: se lleva aparte.</p>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-[var(--color-muted)]">Requerido</dt><dd className="font-semibold">{m(d.required)}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Recibido</dt><dd className="font-semibold">{m(d.received)}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Devuelto / aplicado</dt><dd className="font-semibold">{m(d.returned)} / {m(d.applied)}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Retenido ahora</dt><dd className="font-semibold">{m(d.held)}</dd></div>
        </dl>
        {f.deposits.length > 0 && (
          <ul className="space-y-1 text-sm">{f.deposits.map((x) => (
            <li key={x.id} className={`flex items-center justify-between gap-3 ${x.voided_at ? "opacity-50 line-through" : ""}`}>
              <span>{formatBusinessDateTime(x.occurred_at)} · {KIND[x.kind]} · {dm(x.amount)} · {methodLabel(x.method)}{x.reference ? ` · ${x.reference}` : ""}{x.note ? ` · ${x.note}` : ""}</span>
              {canVoid && !x.voided_at && <VoidForm action={voidAction.bind(null, reservationId, "deposit_movements", x.id)} />}
            </li>))}</ul>)}
        {canWrite && (
          <form action={createDepositAction.bind(null, reservationId)} className="space-y-3 rounded-lg border border-[var(--color-line)] p-3">
            <p className="text-sm font-semibold">Registrar movimiento de depósito</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label>Movimiento<select name="kind" className="input"><option value="received">Recibido</option><option value="returned">Devuelto</option>{canVoid && <option value="applied">Deducción (aplicar a cargos)</option>}</select></label>
              <label>Método<select name="method" className="input"><option value="">—</option>{Object.entries(METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>Importe *<input name="amount" required inputMode="decimal" className="input" /></label>
              <label>Referencia<input name="reference" className="input" /></label>
            </div>
            <label className="block">Nota (obligatoria en deducciones)<input name="note" className="input" /></label>
            <button className="btn btn-secondary">Registrar movimiento</button>
          </form>)}
      </section>
    </>
  );
}
