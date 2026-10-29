import Link from "next/link";
import { requireAuth } from "@/server/auth/permissions";
import { getDashboard } from "@/server/services/dashboard";
import { getPeriodMoney, getOutstanding } from "@/server/services/reports";
import { getAlerts } from "@/server/services/alerts";
import { resolveRange } from "@/lib/ranges";
import type { MoneyMap } from "@/lib/reports";
import { STATUS_LABEL } from "@/lib/vehicle-status";
import { formatMoney, toCents } from "@/lib/money";
import { Badge, PageHeader, Plate, vehicleTone } from "@/components/admin/ui";

const money = (m: MoneyMap) => {
  const e = Object.entries(m);
  return e.length ? e.map(([c, v]) => formatMoney(v, c as "DOP" | "USD")).join(" + ") : formatMoney(0);
};

function StatCard({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: number;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <div
      className={`rounded-2xl border p-5 transition-all shadow-xs ${
        highlight && value > 0
          ? "border-amber-200 bg-amber-50/40 hover:border-amber-300"
          : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function Dashboard() {
  const ctx = await requireAuth();
  const canSee = ctx.permissions.has("reservations:read") && ctx.permissions.has("vehicles:read");
  if (!canSee) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inicio" />
        <p className="empty">Tu rol no tiene acceso a las métricas operativas.</p>
      </div>
    );
  }

  const alerts = await getAlerts(ctx.permissions);
  const d = await getDashboard();
  const canMoney = ctx.permissions.has("reports:read");
  const range = resolveRange();
  const [mny, out] = canMoney ? await Promise.all([getPeriodMoney(range), getOutstanding()]) : [null, null];
  const net: MoneyMap = {};
  if (mny) for (const [c, v] of Object.entries(mny.collected)) net[c] = v - (mny.refunds[c] ?? 0);
  const today = new Intl.DateTimeFormat("es-DO", { dateStyle: "full", timeZone: "America/Santo_Domingo" }).format(
    new Date()
  );

  return (
    <div className="space-y-10">
      <PageHeader title="Inicio" subtitle={today} />

      {alerts.length > 0 && (
        <section aria-label="Requiere atención" className="rounded-2xl border border-amber-200/90 bg-amber-50/60 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900">Requiere atención</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {alerts.map((a) => (
              <li key={a.key}>
                <Link
                  href={a.href}
                  className="flex items-center gap-2.5 rounded-lg bg-white/80 p-2.5 text-slate-800 transition-colors hover:bg-white hover:text-[var(--color-brand)]"
                >
                  <Badge tone={a.tone}>{a.tone === "red" ? "Urgente" : "Revisar"}</Badge>
                  <span className="font-medium">{a.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Operación hoy */}
      <section aria-label="Operación de hoy" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Operación de hoy</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Solicitudes por revisar"
            value={d.pending}
            href="/admin/reservas?status=pending"
            highlight={true}
          />
          <StatCard label="Entregas hoy" value={d.pickupsToday} />
          <StatCard label="Devoluciones hoy" value={d.returnsToday} />
          <StatCard label="Devoluciones en 7 días" value={d.upcomingReturns} />
        </div>
      </section>

      {/* Estado de la flota */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Estado de la flota</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {d.counts.available} de {d.counts.total} vehículos listos para alquilar
            </p>
          </div>
          <Link href="/admin/vehiculos" className="text-xs font-semibold text-[var(--color-brand)] hover:underline">
            Ver flota completa →
          </Link>
        </div>

        {d.vehicles.length === 0 ? (
          <p className="empty">
            Todavía no hay vehículos registrados.{" "}
            <Link href="/admin/vehiculos/nuevo" className="font-semibold underline">
              Registra el primero
            </Link>
            .
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Matrícula</th>
                  <th>Tarifa diaria</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {d.vehicles.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/admin/vehiculos/${v.id}`} className="row-link font-semibold text-slate-900">
                        {v.make} {v.model}
                      </Link>{" "}
                      <span className="text-xs text-slate-500">{v.year}</span>
                    </td>
                    <td>
                      <Plate>{v.plate}</Plate>
                    </td>
                    <td className="font-medium text-slate-700">
                      {formatMoney(toCents(v.daily_rate), v.currency)}
                    </td>
                    <td>
                      <Badge tone={vehicleTone(v.status)}>{STATUS_LABEL[v.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Finanzas */}
      {mny && out ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Balance del período</h2>
              <p className="text-xs text-slate-500 mt-0.5">Del {range.from} a hoy</p>
            </div>
            <Link href="/admin/reportes" className="text-xs font-semibold text-[var(--color-brand)] hover:underline">
              Ver reporte financiero →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cobrado (neto)</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{money(net)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saldos por cobrar</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-sky-700">{money(out.balances)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Depósitos retenidos</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-800">{money(out.deposits)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gastos registrados</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700">{money(mny.expenses)}</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
