import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/permissions";
import {
  getInvoiceDetail,
  INVOICE_STATUS_LABEL,
  FISCAL_TYPE_LABEL,
} from "@/server/services/invoices";
import { formatMoney, toCents } from "@/lib/money";
import { formatBusinessDateTime } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/validators/finance";
import { PrintToolbar } from "@/components/admin/PrintToolbar";

export default async function InvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("payments:read");
  const { id } = await params;

  const detail = await getInvoiceDetail(id);
  if (!detail) notFound();

  const { invoice, items, customer, vehicle, reservation, company, payments, totals } = detail;
  const m = (cents: number) => formatMoney(cents, invoice.currency);
  const customerName = invoice.customer_tax_name || customer?.full_name || "Cliente";
  const customerDoc = invoice.customer_tax_id || customer?.id_number || null;

  const isFiscalIssued = invoice.document_scope !== "internal" && Boolean(invoice.ncf_or_ecf);

  return (
    <div className="mx-auto max-w-4xl">
      <PrintToolbar
        backHref={`/admin/facturacion/${invoice.id}`}
        docTitle={`${invoice.code}_${customerName.replace(/\s+/g, "_")}`}
      />

      {/* Contenedor imprimible de la Factura */}
      <article className="print-sheet rounded-2xl border border-slate-200 bg-white p-8 text-slate-800 shadow-sm md:p-12">
        {/* Cabecera con Logo y Datos de Hally Rent a Car + Recuadro Fiscal/Interno */}
        <header className="flex flex-col justify-between gap-6 border-b-2 border-[#0b2347] pb-6 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <img
              src="/logo-public-dark.png"
              alt={company.name || "Hally Rent a Car"}
              className="h-14 w-auto object-contain"
            />
            <p className="text-sm font-bold text-[#0b2347] pt-1">
              {company.legal_name || company.name || "Hally Rent a Car"}
            </p>
            {company.rnc && (
              <p className="text-xs text-slate-600">
                <strong>RNC:</strong> {company.rnc}
              </p>
            )}
            {company.address && <p className="text-xs text-slate-600 max-w-xs">{company.address}</p>}
            {(company.phone || company.whatsapp_number) && (
              <p className="text-xs text-slate-600">
                <strong>Tel / WhatsApp:</strong> {company.phone || company.whatsapp_number}
              </p>
            )}
          </div>

          <div className="rounded-xl border-2 border-[#0b2347] bg-slate-50 p-4 text-right sm:min-w-[270px]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#229ed9]">
              {isFiscalIssued ? FISCAL_TYPE_LABEL[invoice.fiscal_type] : "DOCUMENTO DE CONTROL INTERNO"}
            </p>
            <h1 className="mt-0.5 text-xl font-extrabold text-[#0b2347]">
              {isFiscalIssued ? "FACTURA FISCAL" : "FACTURA INTERNA"}
            </h1>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">
              N.º {invoice.code}
            </p>

            {isFiscalIssued ? (
              <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700 space-y-0.5">
                <p>
                  <strong>{invoice.fiscal_type.startsWith("E") ? "e-CF:" : "NCF:"}</strong>{" "}
                  <span className="font-mono font-bold">{invoice.ncf_or_ecf}</span>
                </p>
                {invoice.ncf_expiration_date && (
                  <p>
                    <strong>Válido hasta:</strong> {invoice.ncf_expiration_date}
                  </p>
                )}
                {invoice.security_code && (
                  <p>
                    <strong>Cód. Seguridad e-CF:</strong> {invoice.security_code}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                Sin valor de crédito fiscal DGII (NCF / e-CF no emitido)
              </p>
            )}

            <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
              <p>
                <strong>Fecha Emisión:</strong> {invoice.issue_date}
              </p>
              <p>
                <strong>Fecha Vencimiento:</strong> {invoice.due_date}
              </p>
              <p className="mt-1 font-bold text-slate-900">
                Estado: {INVOICE_STATUS_LABEL[totals.computedStatus].toUpperCase()}
              </p>
            </div>
          </div>
        </header>

        {/* Datos del Cliente y del Alquiler/Vehículo */}
        <section className="my-6 grid gap-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-slate-400">Facturado a</p>
            <p className="text-sm font-bold text-slate-900">{customerName}</p>
            {customerDoc && (
              <p>
                <strong>RNC / Cédula / Pasaporte:</strong> {customerDoc}
              </p>
            )}
            {customer?.phone && (
              <p>
                <strong>Teléfono:</strong> {customer.phone}
              </p>
            )}
            {customer?.email && (
              <p>
                <strong>Correo:</strong> {customer.email}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-slate-400">Detalles del Alquiler / Referencia</p>
            <p>
              <strong>Origen:</strong>{" "}
              {reservation ? `Reserva ${reservation.code}` : "Facturación Directa / Manual"}
            </p>
            {vehicle && (
              <p>
                <strong>Vehículo:</strong> {vehicle.make} {vehicle.model} {vehicle.year} · Placa{" "}
                <span className="font-mono font-bold">{vehicle.plate}</span>
              </p>
            )}
            {reservation && (
              <>
                <p>
                  <strong>Entrega:</strong> {formatBusinessDateTime(reservation.pickup_at)}
                  {reservation.pickup_location ? ` (${reservation.pickup_location})` : ""}
                </p>
                <p>
                  <strong>Devolución:</strong> {formatBusinessDateTime(reservation.return_at)}
                  {reservation.return_location ? ` (${reservation.return_location})` : ""}
                </p>
              </>
            )}
            <p>
              <strong>Moneda:</strong> {invoice.currency === "DOP" ? "Pesos Dominicanos (RD$)" : "Dólares (US$)"}
            </p>
          </div>
        </section>

        {/* Tabla de Conceptos */}
        <section className="my-6">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#0b2347] bg-[#0b2347] text-white">
                <th className="py-2.5 px-3 font-bold uppercase">Descripción / Concepto</th>
                <th className="py-2.5 px-3 text-center font-bold uppercase w-24">Cant. / Días</th>
                <th className="py-2.5 px-3 text-right font-bold uppercase w-32">Precio Unit.</th>
                <th className="py-2.5 px-3 text-right font-bold uppercase w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="py-3 px-3 font-medium text-slate-900">{it.description}</td>
                  <td className="py-3 px-3 text-center text-slate-700">{Number(it.quantity)}</td>
                  <td className="py-3 px-3 text-right text-slate-700">{m(toCents(it.unit_price))}</td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-900">
                    {m(toCents(it.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totales y Balance */}
        <section className="grid gap-6 border-t-2 border-slate-200 pt-6 sm:grid-cols-2">
          <div className="space-y-3 text-xs text-slate-600">
            {invoice.notes && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-bold text-slate-800 mb-1">Notas y Condiciones:</p>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            {payments.filter((p) => !p.voided_at).length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="font-bold text-slate-800 mb-1.5">Pagos / Recibos Aplicados:</p>
                <ul className="space-y-1 text-[11px]">
                  {payments
                    .filter((p) => !p.voided_at)
                    .map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>
                          {p.receipt_number ?? "REC"} · {formatBusinessDateTime(p.paid_at)} (
                          {METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] ?? p.method})
                        </span>
                        <span className="font-semibold">
                          {p.kind === "refund" ? "-" : ""}
                          {m(toCents(p.amount))}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end">
            <div className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">{m(totals.subtotalCents)}</span>
              </div>
              {totals.discountCents > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Descuento:</span>
                  <span>- {m(totals.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>ITBIS ({Number(invoice.tax_rate)}%):</span>
                <span className="font-semibold text-slate-900">{m(totals.taxCents)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-extrabold text-[#0b2347]">
                <span>TOTAL FACTURADO:</span>
                <span>{m(totals.totalCents)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Monto Pagado / Abonado:</span>
                <span>- {m(totals.paidCents)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-[#0b2347] pt-2 text-sm font-extrabold text-slate-900">
                <span>BALANCE PENDIENTE:</span>
                <span>{m(totals.balanceCents)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Firmas y Pie de Página */}
        <footer className="mt-12 grid grid-cols-2 gap-12 border-t border-slate-200 pt-8 text-center text-xs text-slate-500">
          <div>
            <div className="mx-auto mb-2 w-48 border-b border-slate-400 pt-8" />
            <p className="font-semibold text-slate-700">Despachado por · {company.name || "Hally Rent a Car"}</p>
          </div>
          <div>
            <div className="mx-auto mb-2 w-48 border-b border-slate-400 pt-8" />
            <p className="font-semibold text-slate-700">Recibido conforme · {customerName}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
