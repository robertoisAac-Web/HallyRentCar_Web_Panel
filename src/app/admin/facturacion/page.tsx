import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  listInvoices,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  FISCAL_TYPE_LABEL,
  type InvoiceComputedStatus,
} from "@/server/services/invoices";
import { listReservations } from "@/server/services/reservations";
import { formatMoney, toCents } from "@/lib/money";
import { Badge, PageHeader } from "@/components/admin/ui";
import { generateFromReservationAction } from "./actions";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "paid", label: "Pagadas" },
  { key: "pending", label: "Pendientes" },
  { key: "overdue", label: "Vencidas" },
  { key: "voided", label: "Anuladas" },
];

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    customer?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}) {
  const ctx = await requirePermission("payments:read");
  const canWrite = ctx.permissions.has("payments:write");
  const sp = await searchParams;
  const activeStatus = sp.status ?? "all";

  const sb = await createClient();
  const [{ invoices, summary }, allReservations, { data: customersList }, { data: allInvoiceResIds }] =
    await Promise.all([
      listInvoices({
        status: activeStatus,
        customerId: sp.customer,
        from: sp.from,
        to: sp.to,
        q: sp.q,
      }),
      listReservations(),
      sb.from("customers").select("id,full_name,id_number").order("full_name"),
      sb.from("invoices").select("reservation_id").is("voided_at", null).not("reservation_id", "is", null),
    ]);

  const invoicedResSet = new Set((allInvoiceResIds ?? []).map((x) => x.reservation_id as string));
  const unbilledReservations = allReservations.filter(
    (r) => !invoicedResSet.has(r.id) && r.status !== "rejected" && r.status !== "cancelled"
  );

  const buildFilterHref = (nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (sp.customer) params.set("customer", sp.customer);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.q) params.set("q", sp.q);
    const qs = params.toString();
    return `/admin/facturacion${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        subtitle="Emisión de facturas desde reservas o manuales, cobros parciales/completos, recibos y preparación fiscal DGII."
        action={
          canWrite ? (
            <Link href="/admin/facturacion/nueva" className="btn btn-primary">
              + Nueva factura manual
            </Link>
          ) : undefined
        }
      />

      {/* Aviso de preparación fiscal DGII */}
      <div className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-600" />
            <span>Preparado para Facturación Fiscal DGII (República Dominicana · NCF Serie B y e-CF Serie E)</span>
          </p>
          <p className="text-slate-600">
            Mientras no se registre una secuencia o integración autorizada por la DGII, todos los documentos se emiten e identifican automáticamente como{" "}
            <strong>Factura Interna</strong> sin generar comprobantes fiscales ficticios.
          </p>
        </div>
        <span className="shrink-0 self-start rounded-full border border-sky-300 bg-white px-3 py-1 font-semibold text-sky-900 sm:self-center">
          Modo: Factura Interna / DGII Ready
        </span>
      </div>

      {/* KPIs Financieros */}
      <section className="stat-strip">
        <div className="stat">
          <div className="stat-num">{formatMoney(summary.DOP.billedCents, "DOP")}</div>
          {summary.USD.billedCents > 0 && (
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              + {formatMoney(summary.USD.billedCents, "USD")}
            </div>
          )}
          <div className="stat-label">Total facturado ({summary.counts.total})</div>
        </div>

        <div className="stat">
          <div className="stat-num text-emerald-700">{formatMoney(summary.DOP.paidCents, "DOP")}</div>
          {summary.USD.paidCents > 0 && (
            <div className="text-xs font-semibold text-emerald-600 mt-0.5">
              + {formatMoney(summary.USD.paidCents, "USD")}
            </div>
          )}
          <div className="stat-label">Cobrado · {summary.counts.paid} pagadas</div>
        </div>

        <div className="stat">
          <div className="stat-num text-amber-700">{formatMoney(summary.DOP.pendingCents, "DOP")}</div>
          {summary.USD.pendingCents > 0 && (
            <div className="text-xs font-semibold text-amber-600 mt-0.5">
              + {formatMoney(summary.USD.pendingCents, "USD")}
            </div>
          )}
          <div className="stat-label">Balance pendiente ({summary.counts.pending})</div>
        </div>

        <div className="stat">
          <div className="stat-num text-red-600">{formatMoney(summary.DOP.overdueCents, "DOP")}</div>
          {summary.USD.overdueCents > 0 && (
            <div className="text-xs font-semibold text-red-500 mt-0.5">
              + {formatMoney(summary.USD.overdueCents, "USD")}
            </div>
          )}
          <div className="stat-label">Vencidas ({summary.counts.overdue})</div>
        </div>
      </section>

      {/* Generación automática desde reservas */}
      {canWrite && unbilledReservations.length > 0 && (
        <section className="panel space-y-3 border-emerald-200 bg-emerald-50/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2>Reservas listas para facturar ({unbilledReservations.length})</h2>
              <p className="text-xs text-slate-500">
                Genera la factura automáticamente con los días, tarifa, descuentos, cargos extras y pagos ya registrados en la reserva.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unbilledReservations.slice(0, 6).map((r) => (
              <div
                key={r.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Link href={`/admin/reservas/${r.id}`} className="font-bold text-sm text-slate-900 hover:underline">
                      {r.code}
                    </Link>
                    <span className="text-xs font-semibold text-slate-700">
                      {formatMoney(toCents(r.total_amount), r.currency)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 truncate">{r.customer_name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {r.vehicle_label} · {r.billable_days} día(s)
                  </p>
                </div>
                <form action={generateFromReservationAction.bind(null, r.id)}>
                  <button className="btn btn-primary btn-sm w-full justify-center">
                    Generar factura automática
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filtros de Historial por Cliente, Fecha y Estado */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={buildFilterHref(tab.key)}
                className={`chip ${activeStatus === tab.key ? "chip-active" : ""}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <form method="GET" action="/admin/facturacion" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {activeStatus !== "all" && <input type="hidden" name="status" value={activeStatus} />}

          <label className="block text-xs font-semibold text-slate-600">
            Buscar (Código, Cliente, RNC)
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Ej: FAC-2026, nombre o cédula"
              className="input mt-1"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Filtrar por cliente
            <select name="customer" defaultValue={sp.customer ?? ""} className="input mt-1">
              <option value="">Todos los clientes</option>
              {(customersList ?? []).map((c) => (
                <option key={c.id as string} value={c.id as string}>
                  {c.full_name as string}
                  {c.id_number ? ` (${c.id_number})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Desde fecha
            <input type="date" name="from" defaultValue={sp.from ?? ""} className="input mt-1" />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Hasta fecha
            <input type="date" name="to" defaultValue={sp.to ?? ""} className="input mt-1" />
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="btn btn-primary flex-1 justify-center">
              Filtrar
            </button>
            {(sp.customer || sp.from || sp.to || sp.q || activeStatus !== "all") && (
              <Link href="/admin/facturacion" className="btn btn-secondary">
                Limpiar
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Tabla de Facturas */}
      {invoices.length === 0 ? (
        <div className="empty space-y-3">
          <p>No se encontraron facturas con los criterios seleccionados.</p>
          {canWrite && (
            <div className="flex justify-center gap-3">
              <Link href="/admin/facturacion/nueva" className="btn btn-primary btn-sm">
                Crear primera factura manual
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Factura / Tipo</th>
                <th>Cliente</th>
                <th>Concepto / Origen</th>
                <th>Emisión / Vence</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Balance</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className={inv.voided_at ? "opacity-55" : ""}>
                  <td>
                    <Link href={`/admin/facturacion/${inv.id}`} className="row-link block">
                      {inv.code}
                    </Link>
                    <span className="block text-[11px] text-slate-500">
                      {inv.ncf_or_ecf
                        ? `${inv.fiscal_type}: ${inv.ncf_or_ecf}`
                        : inv.fiscal_type !== "none"
                          ? `Factura Interna (Prep. ${inv.fiscal_type})`
                          : "Factura Interna"}
                    </span>
                  </td>

                  <td>
                    <span className="font-medium text-slate-800 block">{inv.customer_name}</span>
                    {inv.customer_doc && (
                      <span className="text-[11px] text-slate-500">RNC/Doc: {inv.customer_doc}</span>
                    )}
                  </td>

                  <td>
                    {inv.reservation_code ? (
                      <span className="text-xs font-medium text-slate-700 block">
                        Reserva {inv.reservation_code}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 block">Facturación manual</span>
                    )}
                    {inv.vehicle_label && (
                      <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                        {inv.vehicle_label}
                      </span>
                    )}
                  </td>

                  <td className="text-xs">
                    <span className="block text-slate-800">{inv.issue_date}</span>
                    <span
                      className={`block text-[11px] ${
                        inv.computed_status === "overdue" ? "font-bold text-red-600" : "text-slate-500"
                      }`}
                    >
                      Vence: {inv.due_date}
                    </span>
                  </td>

                  <td className="font-semibold">
                    {formatMoney(inv.total_cents, inv.currency)}
                  </td>

                  <td className="text-emerald-700 font-medium">
                    {formatMoney(inv.paid_cents, inv.currency)}
                  </td>

                  <td className={inv.balance_cents > 0 ? "font-bold text-slate-900" : "text-slate-400"}>
                    {formatMoney(inv.balance_cents, inv.currency)}
                  </td>

                  <td>
                    <Badge tone={INVOICE_STATUS_TONE[inv.computed_status as InvoiceComputedStatus]}>
                      {INVOICE_STATUS_LABEL[inv.computed_status as InvoiceComputedStatus]}
                    </Badge>
                  </td>

                  <td>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/facturacion/${inv.id}`} className="btn btn-secondary btn-sm">
                        Ver / Cobrar
                      </Link>
                      <Link
                        href={`/admin/facturacion/${inv.id}/pdf`}
                        className="btn btn-primary btn-sm"
                        title="Abrir vista PDF para imprimir o descargar"
                      >
                        PDF
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
