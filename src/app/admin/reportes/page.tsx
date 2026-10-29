import Link from "next/link";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { requirePermission } from "@/server/auth/permissions";
import { getPeriodMoney, getOutstanding, getPeriodOperations } from "@/server/services/reports";
import { resolveRange } from "@/lib/ranges";
import { formatMoney } from "@/lib/money";
import { CATEGORY_LABEL } from "@/lib/validators/finance";
import { PageHeader } from "@/components/admin/ui";
import type { MoneyMap } from "@/lib/reports";

const money = (m: MoneyMap) => { const e = Object.entries(m); return e.length ? e.map(([c, v]) => formatMoney(v, c as "DOP" | "USD")).join(" + ") : formatMoney(0); };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePermission("reports:read");
  const sp = await searchParams;
  const range = resolveRange(sp.from, sp.to);
  const [mny, out, ops] = await Promise.all([getPeriodMoney(range), getOutstanding(), getPeriodOperations(range)]);
  const vName = new Map(ops.vehicles.map((v) => [v.id, `${v.make} ${v.model} (${v.plate})`]));
  const q = `from=${range.from}&to=${range.to}`;
  const net: MoneyMap = {};
  for (const [c, v] of Object.entries(mny.collected)) net[c] = v - (mny.refunds[c] ?? 0);
  return (
    <div className="space-y-8">
      <PageHeader title="Reportes" subtitle={`${range.from} al ${range.to}`} />
      <form className="flex flex-wrap items-end gap-3">
        <DateTimePicker name="from" mode="date" label="Desde" lang="es" required defaultValue={range.from} />
        <DateTimePicker name="to" mode="date" label="Hasta" lang="es" required defaultValue={range.to} />
        <button className="btn btn-secondary">Aplicar</button>
        <span className="ml-auto flex gap-2 text-sm">
          <Link className="btn btn-secondary btn-sm" href={`/admin/reportes/export?type=payments&${q}`}>CSV cobros</Link>
          <Link className="btn btn-secondary btn-sm" href={`/admin/reportes/export?type=expenses&${q}`}>CSV gastos</Link>
          <Link className="btn btn-secondary btn-sm" href={`/admin/reportes/export?type=reservations&${q}`}>CSV alquileres</Link>
        </span>
      </form>
      <div className="stat-strip">
        <div className="stat"><p className="stat-num text-2xl">{money(net)}</p><p className="stat-label">Cobrado en el período (neto de reembolsos)</p></div>
        <div className="stat"><p className="stat-num text-2xl">{money(out.balances)}</p><p className="stat-label">Saldos pendientes de cobro (reservas vigentes)</p></div>
        <div className="stat"><p className="stat-num text-2xl">{money(out.deposits)}</p><p className="stat-label">Depósitos pendientes de devolver</p></div>
        <div className="stat"><p className="stat-num text-2xl">{money(mny.expenses)}</p><p className="stat-label">Gastos registrados</p></div>
      </div>
      <div className="stat-strip">
        <div className="stat"><p className="stat-num text-2xl">{money(ops.revenue)}</p><p className="stat-label">Ingresos registrados por alquileres</p></div>
        <div className="stat"><p className="stat-num text-2xl">{ops.occupancy}%</p><p className="stat-label">Ocupación de la flota</p></div>
        <div className="stat"><p className="stat-num text-2xl">{ops.rentals}</p><p className="stat-label">Alquileres con recogida en el período</p></div>
        <div className="stat"><p className="stat-num text-2xl">{ops.repeatCustomers}</p><p className="stat-label">Clientes recurrentes · {ops.cancellations} cancelaciones</p></div>
      </div>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="panel"><h2 className="mb-3">Por vehículo</h2>
          <table className="table"><thead><tr><th>Vehículo</th><th>Ingresos</th><th>Gastos</th></tr></thead><tbody>
            {[...new Set([...Object.keys(ops.byVehicle), ...Object.keys(mny.byVehicleExpense)])].map((id) => (
              <tr key={id}><td>{id === "general" ? "General" : vName.get(id) ?? "—"}</td><td>{money(ops.byVehicle[id] ?? {})}</td><td>{money(mny.byVehicleExpense[id] ?? {})}</td></tr>))}
          </tbody></table></div>
        <div className="panel"><h2 className="mb-3">Gastos por categoría</h2>
          <table className="table"><tbody>
            {Object.entries(mny.byCategory).map(([c, m]) => (<tr key={c}><td>{CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c}</td><td>{money(m)}</td></tr>))}
            {Object.keys(mny.byCategory).length === 0 && <tr><td className="text-[var(--color-muted)]">Sin gastos en el período</td></tr>}
          </tbody></table></div>
      </section>
      {out.items.length > 0 && (
        <section className="panel"><h2 className="mb-3">Mayores saldos pendientes</h2>
          <ul className="space-y-1 text-sm">{out.items.map((i) => (<li key={i.id}><Link href={`/admin/reservas/${i.id}`} className="row-link">{i.code}</Link> · {formatMoney(i.balance, i.currency as "DOP" | "USD")}</li>))}</ul></section>)}
      <section className="panel text-sm text-[var(--color-muted)]">
        <h2 className="mb-2 text-[var(--color-ink)]">Cómo se calcula cada cifra</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Cobrado:</strong> pagos y anticipos con fecha de pago en el período, menos reembolsos. No incluye depósitos. Los registros anulados no cuentan.</li>
          <li><strong>Saldos pendientes:</strong> total de la reserva + cargos adicionales − cobrado neto, de reservas confirmadas, en curso o finalizadas (hasta las 400 más recientes).</li>
          <li><strong>Depósitos por devolver:</strong> recibido − devuelto − aplicado. Se lleva aparte de los ingresos.</li>
          <li><strong>Ingresos registrados:</strong> total de reservas confirmadas, en curso o finalizadas con recogida en el período. No equivale a dinero cobrado ni a facturación fiscal.</li>
          <li><strong>Ocupación:</strong> horas con alquiler confirmado, en curso o finalizado ÷ horas disponibles de los vehículos activos.</li>
          <li><strong>Gastos:</strong> gastos con fecha en el período, sin anulados. No es un resultado contable: consulta con tu contador.</li>
        </ul>
      </section>
    </div>
  );
}
