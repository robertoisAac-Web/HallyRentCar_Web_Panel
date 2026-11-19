import { notFound } from "next/navigation";
import { createHash } from "crypto";
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
import { DgiiQrStamp } from "@/components/admin/DgiiQrStamp";

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
  const securityCode =
    invoice.security_code ||
    createHash("sha256").update(`${invoice.id}:${invoice.code}`).digest("hex").slice(0, 6).toUpperCase();
  const signDateFormatted = formatBusinessDateTime(invoice.created_at);

  return (
    <div className="mx-auto max-w-4xl">
      <PrintToolbar
        backHref={`/admin/facturacion/${invoice.id}`}
        docTitle={`${invoice.code}_${customerName.replace(/\s+/g, "_")}`}
      />

      {/* Factura Minimalista en Blanco y Negro con el Logo Oficial */}
      <article className="print-sheet rounded-xl border border-neutral-200 bg-white p-8 text-neutral-900 shadow-xs md:p-12">
        {/* Cabecera sencilla: Logo a la izquierda, numeración limpia a la derecha */}
        <header className="flex flex-col justify-between gap-6 border-b border-neutral-300 pb-6 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <img
              src="/logo-public-dark.png"
              alt={company.name || "Hally Rent a Car"}
              className="h-14 w-auto object-contain mb-2"
            />
            <p className="text-sm font-bold text-neutral-900">
              {company.legal_name || company.name || "HALLY RENT A CAR E INVERSIONES S.R.L."}
            </p>
            {company.rnc && (
              <p className="text-xs text-neutral-600">
                RNC: <span className="font-medium text-neutral-900">{company.rnc}</span>
              </p>
            )}
            {company.address && (
              <p className="text-xs text-neutral-600 max-w-xs leading-relaxed">{company.address}</p>
            )}
            {(company.phone || company.whatsapp_number) && (
              <p className="text-xs text-neutral-600">
                Tel: {company.phone || company.whatsapp_number}
              </p>
            )}
          </div>

          <div className="text-left sm:text-right space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              {isFiscalIssued ? "FACTURA" : "FACTURA"}
            </h1>
            <p className="font-mono text-sm font-semibold text-neutral-900">
              N.º {invoice.code}
            </p>
            <p className="text-xs text-neutral-500">
              {isFiscalIssued ? FISCAL_TYPE_LABEL[invoice.fiscal_type] : "Documento de control interno"}
            </p>

            {isFiscalIssued && (
              <div className="pt-1 text-xs text-neutral-700 space-y-0.5">
                <p>
                  {invoice.fiscal_type.startsWith("E") ? "e-NCF:" : "NCF:"}{" "}
                  <span className="font-mono font-semibold text-neutral-900">{invoice.ncf_or_ecf}</span>
                </p>
                {invoice.ncf_expiration_date && (
                  <p>Vencimiento secuencia: {invoice.ncf_expiration_date}</p>
                )}
                {invoice.security_code && (
                  <p>Código Seguridad: <span className="font-mono">{invoice.security_code}</span></p>
                )}
              </div>
            )}

            <div className="pt-2 text-xs text-neutral-600 space-y-0.5">
              <p>Fecha: <span className="text-neutral-900 font-medium">{invoice.issue_date}</span></p>
              <p>Vence: <span className="text-neutral-900 font-medium">{invoice.due_date}</span></p>
              <p>Estado: <span className="text-neutral-900 font-semibold">{INVOICE_STATUS_LABEL[totals.computedStatus]}</span></p>
            </div>
          </div>
        </header>

        {/* Datos del Cliente y del Vehículo (Sin cajas de color) */}
        <section className="my-7 grid gap-8 border-b border-neutral-200 pb-7 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Cliente
            </p>
            <p className="text-sm font-bold text-neutral-900">{customerName}</p>
            {customerDoc && <p className="text-neutral-600">RNC / Cédula / Doc: {customerDoc}</p>}
            {customer?.phone && <p className="text-neutral-600">Teléfono: {customer.phone}</p>}
            {customer?.email && <p className="text-neutral-600">Correo: {customer.email}</p>}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Detalle del Alquiler
            </p>
            {reservation && (
              <p className="text-neutral-700">
                Contrato / Reserva: <span className="font-semibold text-neutral-900">{reservation.code}</span>
              </p>
            )}
            {vehicle && (
              <p className="text-neutral-700">
                Vehículo:{" "}
                <span className="font-semibold text-neutral-900">
                  {vehicle.make} {vehicle.model} {vehicle.year}
                </span>{" "}
                (Placa {vehicle.plate})
              </p>
            )}
            {reservation && (
              <>
                <p className="text-neutral-600">
                  Entrega: {formatBusinessDateTime(reservation.pickup_at)}
                  {reservation.pickup_location ? ` · ${reservation.pickup_location}` : ""}
                </p>
                <p className="text-neutral-600">
                  Devolución: {formatBusinessDateTime(reservation.return_at)}
                  {reservation.return_location ? ` · ${reservation.return_location}` : ""}
                </p>
              </>
            )}
          </div>
        </section>

        {/* Tabla de Conceptos Limpia (Sin barras oscuras) */}
        <section className="my-6">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-900 text-neutral-900">
                <th className="py-2.5 pr-3 font-semibold uppercase tracking-wider">Concepto</th>
                <th className="py-2.5 px-3 text-center font-semibold uppercase tracking-wider w-24">Cant. / Días</th>
                <th className="py-2.5 px-3 text-right font-semibold uppercase tracking-wider w-32">Precio Unit.</th>
                <th className="py-2.5 pl-3 text-right font-semibold uppercase tracking-wider w-32">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="py-3.5 pr-3 text-neutral-900">{it.description}</td>
                  <td className="py-3.5 px-3 text-center text-neutral-700">{Number(it.quantity)}</td>
                  <td className="py-3.5 px-3 text-right text-neutral-700">{m(toCents(it.unit_price))}</td>
                  <td className="py-3.5 pl-3 text-right font-semibold text-neutral-900">
                    {m(toCents(it.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totales y Pagos */}
        <section className="mt-8 grid gap-8 border-t border-neutral-300 pt-6 sm:grid-cols-2">
          <div className="space-y-4 text-xs text-neutral-600">
            {payments.filter((p) => !p.voided_at).length > 0 && (
              <div className="space-y-1.5">
                <p className="font-semibold text-neutral-900">Pagos recibidos:</p>
                <ul className="space-y-1 text-[11px]">
                  {payments
                    .filter((p) => !p.voided_at)
                    .map((p) => (
                      <li key={p.id} className="flex justify-between border-b border-neutral-100 pb-1">
                        <span>
                          {p.receipt_number ?? "REC"} · {formatBusinessDateTime(p.paid_at)} (
                          {METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] ?? p.method}
                          {p.bank_name ? ` - ${p.bank_name}` : ""})
                        </span>
                        <span className="font-medium text-neutral-900">
                          {p.kind === "refund" ? "-" : ""}
                          {m(toCents(p.amount))}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {invoice.notes && (
              <div className="space-y-1">
                <p className="font-semibold text-neutral-900">Observaciones:</p>
                <p className="whitespace-pre-wrap text-neutral-600">{invoice.notes}</p>
              </div>
            )}

            <DgiiQrStamp
              rncEmisor={company.rnc || "133683687"}
              rncComprador={customerDoc}
              encf={invoice.ncf_or_ecf || invoice.code}
              fechaEmision={invoice.issue_date}
              montoTotal={(totals.totalCents / 100).toFixed(2)}
              fechaFirma={signDateFormatted}
              codigoSeguridad={securityCode}
              isFiscal={isFiscalIssued}
            />
          </div>

          <div className="flex flex-col items-end">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="font-medium text-neutral-900">{m(totals.subtotalCents)}</span>
              </div>
              {totals.discountCents > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Descuento</span>
                  <span>- {m(totals.discountCents)}</span>
                </div>
              )}
              {totals.taxCents > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>ITBIS ({Number(invoice.tax_rate)}%)</span>
                  <span className="font-medium text-neutral-900">{m(totals.taxCents)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-300 pt-2 text-sm font-bold text-neutral-900">
                <span>Total</span>
                <span>{m(totals.totalCents)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Pagado</span>
                <span>{m(totals.paidCents)}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-900 pt-2 text-sm font-bold text-neutral-900">
                <span>Balance Pendiente</span>
                <span>{m(totals.balanceCents)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Firmas sencillas */}
        <footer className="mt-16 grid grid-cols-2 gap-12 pt-8 text-center text-xs text-neutral-500">
          <div>
            <div className="mx-auto mb-2 w-48 border-b border-neutral-400" />
            <p className="font-medium text-neutral-700">{company.name || "Hally Rent a Car"}</p>
          </div>
          <div>
            <div className="mx-auto mb-2 w-48 border-b border-neutral-400" />
            <p className="font-medium text-neutral-700">{customerName}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
