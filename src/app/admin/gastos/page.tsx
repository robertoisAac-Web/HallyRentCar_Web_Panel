import Link from "next/link";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { requirePermission } from "@/server/auth/permissions";
import { listExpenses } from "@/server/services/expenses";
import { signedUrl } from "@/server/storage";
import { resolveRange } from "@/lib/ranges";
import { formatMoney, toCents } from "@/lib/money";
import { CATEGORY_LABEL } from "@/lib/validators/finance";
import { Badge, ErrorBox, OkBox, PageHeader } from "@/components/admin/ui";
import { voidExpenseAction } from "./actions";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; error?: string; ok?: string }> }) {
  const ctx = await requirePermission("expenses:read");
  const sp = await searchParams;
  const range = resolveRange(sp.from, sp.to);
  const rows = await listExpenses(range.from, range.to);
  const urls = new Map<string, string>();
  for (const r of rows) if (r.receipt_path) { const u = await signedUrl("expense-receipts", r.receipt_path); if (u) urls.set(r.id, u); }
  const canWrite = ctx.permissions.has("expenses:write");
  return (
    <div>
      <PageHeader title="Gastos" subtitle={`${range.from} al ${range.to}`}
        action={canWrite ? <Link href="/admin/gastos/nuevo" className="btn btn-primary">Nuevo gasto</Link> : undefined} />
      <ErrorBox error={sp.error} /><OkBox ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <DateTimePicker name="from" mode="date" label="Desde" lang="es" required defaultValue={range.from} />
        <DateTimePicker name="to" mode="date" label="Hasta" lang="es" required defaultValue={range.to} />
        <button className="btn btn-secondary">Filtrar</button>
      </form>
      {rows.length === 0 ? <p className="empty">No hay gastos en este período.</p> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Vehículo</th><th>Proveedor</th><th>Importe</th><th>Comprobante</th><th></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className={r.voided_at ? "opacity-50" : ""}>
              <td>{r.expense_date}</td>
              <td>{CATEGORY_LABEL[r.category as keyof typeof CATEGORY_LABEL] ?? r.category}{r.voided_at && <> <Badge tone="red">Anulado</Badge></>}</td>
              <td>{r.vehicle_label}</td><td>{r.vendor ?? "—"}</td>
              <td>{formatMoney(toCents(r.amount), r.currency)}</td>
              <td>{urls.get(r.id) ? <a href={urls.get(r.id)} target="_blank" rel="noreferrer" className="row-link">Ver</a> : "—"}</td>
              <td>{canWrite && !r.voided_at && (
                <details><summary className="cursor-pointer text-xs underline">Anular…</summary>
                  <form action={voidExpenseAction.bind(null, r.id)} className="mt-2 flex gap-2">
                    <input name="reason" required minLength={3} placeholder="Motivo" className="input" />
                    <button className="btn btn-danger btn-sm">Confirmar</button></form></details>)}</td>
            </tr>))}</tbody></table></div>)}
    </div>
  );
}
