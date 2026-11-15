import Link from "next/link";
import { getReservationFinance } from "@/server/services/finance";
import { listBankAccounts, getActiveShiftForCurrentUser } from "@/server/services/cash-and-banks";
import { formatBusinessDateTime } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { DEPOSIT_STATUS_LABEL } from "@/lib/finance";
import { METHOD_LABEL } from "@/lib/validators/finance";
import { Badge } from "./ui";
import { MixedPaymentForm } from "./MixedPaymentForm";
import { createPaymentAction, createChargeAction, createDepositAction, voidAction } from "@/app/admin/reservas/finance-actions";

const KIND: Record<string, string> = { advance: "Anticipo", payment: "Pago", refund: "Reembolso", received: "Depósito recibido", returned: "Depósito devuelto", applied: "Deducción aplicada" };
const methodLabel = (m: string | null) => (m ? METHOD_LABEL[m as keyof typeof METHOD_LABEL] ?? m : "—");

function VoidForm({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs underline text-red-600">Anular…</summary>
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
  const [f, bankAccounts, activeShift] = await Promise.all([
    getReservationFinance(reservationId, total, depositRequired),
    listBankAccounts(true),
    getActiveShiftForCurrentUser(),
  ]);
  const m = (c: number) => formatMoney(c, currency);
  const dm = (a: string) => formatMoney(toCents(a), currency);
  const b = f.balance, d = f.deposit;
  return (
    <>
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2>Cobros del Contrato (Pagos Simples y Mixtos)</h2>
            <p className="text-xs text-slate-500">
              Cada cobro genera su recibo numerado, vincula la factura del contrato y registra el efectivo en caja o el banco receptor.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-[var(--color-muted)]">Total a pagar</dt><dd className="font-semibold">{m(b.due)}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Cobrado (neto)</dt><dd className="font-semibold text-emerald-700">{m(b.netReceived)}</dd></div>
          <div><dt className="text-[var(--color-muted)]">{b.balance < 0 ? "Saldo a favor del cliente" : "Saldo pendiente"}</dt><dd className="font-semibold">{m(Math.abs(b.balance))}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Cargos adicionales</dt><dd className="font-semibold">{m(b.chargesTotal)}</dd></div>
        </dl>
        {f.payments.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Todavía no hay pagos registrados en este contrato.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Recibo</th><th>Fecha</th><th>Tipo</th><th>Método / Banco / Caja</th><th>Referencia</th><th>Importe</th><th>Acciones</th></tr></thead>
            <tbody>{f.payments.map((p) => (
              <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                <td className="font-mono text-xs font-semibold">{p.receipt_number ?? "REC"}</td>
                <td>{formatBusinessDateTime(p.paid_at)}</td>
                <td>
                  {KIND[p.kind]}
                  {p.payment_group_id && <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">Mixto</span>}
                  {p.voided_at && <> <Badge tone="red">Anulado</Badge></>}
                </td>
                <td>
                  <span className="font-medium">{methodLabel(p.method)}</span>
                  {p.bank_name && <span className="block text-xs text-slate-500">Banco: {p.bank_name}</span>}
                  {p.method === "cash" && p.cash_shift_id && <span className="block text-[11px] text-emerald-700">Asignado a Caja</span>}
                </td>
                <td className="font-mono text-xs">{p.reference ?? "—"}</td>
                <td className="font-semibold">{p.kind === "refund" ? "-" : ""}{dm(p.amount)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    {!p.voided_at && p.invoice_id && (
                      <Link href={`/admin/facturacion/${p.invoice_id}/recibo/${p.id}`} className="btn btn-secondary btn-sm">
                        Recibo PDF
                      </Link>
                    )}
                    {canVoid && !p.voided_at && <VoidForm action={voidAction.bind(null, reservationId, "payments", p.id)} />}
                    {p.void_reason && <span className="text-xs">{p.void_reason}</span>}
                  </div>
                </td>
              </tr>))}</tbody></table></div>)}
        {f.charges.length > 0 && (
          <ul className="space-y-1 text-sm">{f.charges.map((c) => (
            <li key={c.id} className={`flex items-center justify-between gap-3 ${c.voided_at ? "opacity-50 line-through" : ""}`}>
              <span>Cargo: {c.description} · {dm(c.amount)}</span>
              {canVoid && !c.voided_at && <VoidForm action={voidAction.bind(null, reservationId, "reservation_charges", c.id)} />}
            </li>))}</ul>)}
        {canWrite && (
          <div className="space-y-4">
            <MixedPaymentForm
              action={createPaymentAction.bind(null, reservationId)}
              currency={currency}
              balanceCents={Math.max(0, b.balance)}
              canVoid={canVoid}
              bankAccounts={bankAccounts}
              activeShiftCode={activeShift?.shift.code ?? null}
            />

            <form action={createChargeAction.bind(null, reservationId)} className="space-y-3 rounded-xl border border-[var(--color-line)] p-4">
              <p className="text-sm font-semibold">Agregar cargo adicional al contrato</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-2">Descripción *<input name="description" required placeholder="Ej: día extra, entrega aeropuerto, limpieza" className="input" /></label>
                <label className="block">Importe ({currency}) *<input name="amount" required inputMode="decimal" className="input" /></label>
              </div>
              <button className="btn btn-secondary btn-sm">Agregar cargo</button>
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
