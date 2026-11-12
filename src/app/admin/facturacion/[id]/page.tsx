import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import {
  getInvoiceDetail,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  FISCAL_TYPE_LABEL,
} from "@/server/services/invoices";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { formatBusinessDateTime } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/validators/finance";
import { whatsappLink } from "@/lib/whatsapp";
import { Badge, ErrorBox, OkBox } from "@/components/admin/ui";
import {
  recordInvoicePaymentAction,
  voidInvoiceAction,
  voidInvoicePaymentAction,
} from "../actions";

const KIND_LABEL: Record<string, string> = {
  advance: "Anticipo",
  payment: "Pago / Abono",
  refund: "Reembolso",
};

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await requirePermission("payments:read");
  const canWrite = ctx.permissions.has("payments:write");
  const canVoid = ctx.permissions.has("payments:void");

  const { id } = await params;
  const { error, ok } = await searchParams;

  const detail = await getInvoiceDetail(id);
  if (!detail) notFound();

  const { invoice, items, customer, vehicle, reservation, payments, totals } = detail;
  const m = (cents: number) => formatMoney(cents, invoice.currency);
  const customerName = invoice.customer_tax_name || customer?.full_name || "Cliente";
  const customerDoc = invoice.customer_tax_id || customer?.id_number || null;

  const waText = `Hola ${customerName.split(" ")[0]}, te compartimos el resumen de tu factura ${invoice.code} de Hally Rent a Car por un total de ${m(totals.totalCents)}. Pagado: ${m(totals.paidCents)}. Balance pendiente: ${m(totals.balanceCents)}.`;
  const waUrl = whatsappLink(customer?.phone, waText);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link href="/admin/facturacion" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
            ← Volver a Facturación
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="page-title">{invoice.code}</h1>
            <Badge tone={INVOICE_STATUS_TONE[totals.computedStatus]}>
              {INVOICE_STATUS_LABEL[totals.computedStatus]}
            </Badge>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-0.5 text-xs font-semibold text-slate-700">
              {invoice.document_scope === "internal"
                ? "Factura Interna (No Fiscal)"
                : `Comprobante Fiscal ${invoice.fiscal_type}`}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {FISCAL_TYPE_LABEL[invoice.fiscal_type]}
            {invoice.ncf_or_ecf ? ` · NCF/e-CF: ${invoice.ncf_or_ecf}` : " · Documento de control interno"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/facturacion/${invoice.id}/pdf`} className="btn btn-primary">
            Descargar / Imprimir Factura PDF
          </Link>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
              Enviar por WhatsApp
            </a>
          )}
        </div>
      </div>

      <ErrorBox error={error} />
      <OkBox ok={ok} error={error} />

      {/* Resumen de saldos */}
      <section className="stat-strip">
        <div className="stat">
          <div className="stat-num">{m(totals.totalCents)}</div>
          <div className="stat-label">Total Facturado</div>
        </div>
        <div className="stat">
          <div className="stat-num text-emerald-700">{m(totals.paidCents)}</div>
          <div className="stat-label">Total Cobrado</div>
        </div>
        <div className="stat">
          <div className={`stat-num ${totals.balanceCents > 0 ? "text-amber-700" : "text-slate-400"}`}>
            {m(totals.balanceCents)}
          </div>
          <div className="stat-label">Balance Pendiente</div>
        </div>
        <div className="stat">
          <div className="text-base font-bold text-slate-900">{invoice.due_date}</div>
          <div className="stat-label">Emisión: {invoice.issue_date} · Vencimiento</div>
        </div>
      </section>

      {/* Datos del Cliente, Vehículo y Reserva */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel space-y-2 text-sm">
          <h2>Datos del Cliente</h2>
          <p className="font-semibold text-slate-900 text-base">{customerName}</p>
          {customerDoc && (
            <p className="text-slate-600">
              <span className="font-medium text-slate-500">RNC / Cédula / Doc:</span> {customerDoc}
            </p>
          )}
          {customer?.phone && (
            <p className="text-slate-600">
              <span className="font-medium text-slate-500">Teléfono:</span> {customer.phone}
            </p>
          )}
          {customer?.email && (
            <p className="text-slate-600">
              <span className="font-medium text-slate-500">Correo:</span> {customer.email}
            </p>
          )}
        </div>

        <div className="panel space-y-2 text-sm">
          <h2>Referencia Operativa y Fiscal</h2>
          <p className="text-slate-600">
            <span className="font-medium text-slate-500">Origen:</span>{" "}
            {reservation ? (
              <Link href={`/admin/reservas/${reservation.id}`} className="font-semibold text-slate-900 underline">
                Reserva {reservation.code}
              </Link>
            ) : (
              "Factura Manual"
            )}
          </p>
          {vehicle && (
            <p className="text-slate-600">
              <span className="font-medium text-slate-500">Vehículo:</span> {vehicle.make} {vehicle.model} {vehicle.year} ({vehicle.plate})
            </p>
          )}
          <p className="text-slate-600">
            <span className="font-medium text-slate-500">Clasificación DGII:</span>{" "}
            {invoice.ncf_or_ecf ? (
              <span className="font-mono font-semibold text-slate-900">{invoice.ncf_or_ecf}</span>
            ) : (
              <span>Factura Interna (Sin NCF emitido)</span>
            )}
          </p>
          {invoice.voided_at && (
            <p className="text-red-700 font-semibold">
              Anulada: {invoice.void_reason}
            </p>
          )}
        </div>
      </section>

      {/* Detalle de Renglones / Conceptos */}
      <section className="panel space-y-4">
        <h2>Detalle de Conceptos Facturados</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Concepto / Descripción</th>
                <th>Cant. / Días</th>
                <th>Precio Unit.</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="font-medium text-slate-800">{it.description}</td>
                  <td>{Number(it.quantity)}</td>
                  <td>{m(toCents(it.unit_price))}</td>
                  <td className="font-semibold">{m(toCents(it.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end space-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <div className="flex w-full max-w-xs justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-900">{m(totals.subtotalCents)}</span>
          </div>
          {totals.discountCents > 0 && (
            <div className="flex w-full max-w-xs justify-between text-emerald-700">
              <span>Descuento:</span>
              <span>- {m(totals.discountCents)}</span>
            </div>
          )}
          <div className="flex w-full max-w-xs justify-between text-slate-600">
            <span>ITBIS ({Number(invoice.tax_rate)}%):</span>
            <span>+ {m(totals.taxCents)}</span>
          </div>
          <div className="flex w-full max-w-xs justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>Total Factura:</span>
            <span>{m(totals.totalCents)}</span>
          </div>
          <div className="flex w-full max-w-xs justify-between text-emerald-700 font-medium">
            <span>Pagado / Abonado:</span>
            <span>{m(totals.paidCents)}</span>
          </div>
          <div className="flex w-full max-w-xs justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>Balance Pendiente:</span>
            <span>{m(totals.balanceCents)}</span>
          </div>
        </div>

        {invoice.notes && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200/70">
            <span className="font-semibold text-slate-800">Notas: </span>
            {invoice.notes}
          </div>
        )}
      </section>

      {/* Registro de Pagos Completos o Parciales y Generación de Recibos */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2>Pagos y Recibos de Ingreso</h2>
            <p className="text-xs text-slate-500">
              Cada pago (completo o parcial) genera automáticamente un Recibo de Pago numerado en PDF.
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no se han registrado pagos en esta factura.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Recibo #</th>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Método / Ref.</th>
                  <th>Importe</th>
                  <th>Recibo PDF</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                    <td className="font-mono font-semibold text-xs text-slate-900">
                      {p.receipt_number ?? `REC-${p.id.slice(0, 6).toUpperCase()}`}
                    </td>
                    <td>{formatBusinessDateTime(p.paid_at)}</td>
                    <td>
                      {KIND_LABEL[p.kind] ?? p.kind}
                      {p.voided_at && (
                        <>
                          {" "}
                          <Badge tone="red">Anulado</Badge>
                        </>
                      )}
                    </td>
                    <td>
                      {METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] ?? p.method}
                      {p.reference ? ` · Ref: ${p.reference}` : ""}
                      {p.note ? <span className="block text-xs text-slate-500">{p.note}</span> : null}
                    </td>
                    <td className="font-semibold">
                      {p.kind === "refund" ? "-" : ""}
                      {m(toCents(p.amount))}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {!p.voided_at && (
                          <Link
                            href={`/admin/facturacion/${invoice.id}/recibo/${p.id}`}
                            className="btn btn-primary btn-sm"
                          >
                            Ver Recibo PDF
                          </Link>
                        )}
                        {canVoid && !p.voided_at && (
                          <details>
                            <summary className="cursor-pointer text-xs text-red-600 underline">Anular</summary>
                            <form
                              action={voidInvoicePaymentAction.bind(null, invoice.id, p.id)}
                              className="mt-2 flex gap-1.5"
                            >
                              <input
                                name="reason"
                                required
                                minLength={3}
                                placeholder="Motivo"
                                className="input text-xs py-1"
                              />
                              <button className="btn btn-danger btn-sm">Confirmar</button>
                            </form>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && !invoice.voided_at && (
          <form
            action={recordInvoicePaymentAction.bind(null, invoice.id)}
            className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">
                Registrar pago (completo o abono parcial)
              </p>
              {totals.balanceCents > 0 && (
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Saldo pendiente: {m(totals.balanceCents)}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-slate-700">
                Tipo de movimiento
                <select name="kind" defaultValue="payment" className="input mt-1">
                  <option value="payment">Pago / Abono</option>
                  <option value="advance">Anticipo</option>
                  {canVoid && <option value="refund">Reembolso</option>}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Método de pago *
                <select name="method" defaultValue="cash" className="input mt-1">
                  {Object.entries(METHOD_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Importe ({invoice.currency}) *
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  defaultValue={totals.balanceCents > 0 ? fromCents(totals.balanceCents) : ""}
                  placeholder="0.00"
                  className="input mt-1"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Referencia (si no es efectivo)
                <input
                  name="reference"
                  placeholder="Núm. transferencia / autorización"
                  className="input mt-1"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block flex-1 min-w-[220px] text-xs font-semibold text-slate-700">
                Concepto o nota del recibo (opcional)
                <input
                  name="note"
                  placeholder="Ej: Abono del 50% / Saldo final al entregar vehículo"
                  className="input mt-1"
                />
              </label>
              <button type="submit" className="btn btn-primary">
                Registrar pago y generar recibo
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Anular factura */}
      {canVoid && !invoice.voided_at && (
        <section className="panel border-red-200/70">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-red-700">
              Anular esta factura…
            </summary>
            <form
              action={voidInvoiceAction.bind(null, invoice.id)}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <label className="block flex-1 min-w-[240px] text-xs font-semibold text-slate-700">
                Motivo de anulación *
                <input
                  name="reason"
                  required
                  minLength={3}
                  placeholder="Ej: Error en datos o reserva cancelada"
                  className="input mt-1"
                />
              </label>
              <button type="submit" className="btn btn-danger">
                Confirmar anulación de factura
              </button>
            </form>
          </details>
        </section>
      )}
    </div>
  );
}
