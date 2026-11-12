import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/permissions";
import { getInvoiceDetail } from "@/server/services/invoices";
import { formatMoney, toCents } from "@/lib/money";
import { formatBusinessDateTime } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/validators/finance";
import { PrintToolbar } from "@/components/admin/PrintToolbar";

const KIND_TITLE: Record<string, string> = {
  advance: "RECIBO DE ANTICIPO",
  payment: "RECIBO DE PAGO / INGRESO",
  refund: "COMPROBANTE DE REEMBOLSO",
};

export default async function PaymentReceiptPdfPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  await requirePermission("payments:read");
  const { id, paymentId } = await params;

  const detail = await getInvoiceDetail(id);
  if (!detail) notFound();

  const { invoice, customer, vehicle, reservation, company, payments, totals } = detail;
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) notFound();

  const m = (cents: number) => formatMoney(cents, invoice.currency);
  const customerName = invoice.customer_tax_name || customer?.full_name || "Cliente";
  const customerDoc = invoice.customer_tax_id || customer?.id_number || null;
  const receiptCode = payment.receipt_number || `REC-${payment.id.slice(0, 8).toUpperCase()}`;

  // Calcular balance hasta este pago
  const validPayments = payments.filter((p) => !p.voided_at);
  let paidBeforeCents = 0;
  for (const p of validPayments) {
    if (p.id === payment.id) break;
    const c = toCents(p.amount);
    paidBeforeCents += p.kind === "refund" ? -c : c;
  }
  const thisAmountCents = toCents(payment.amount);
  const paidAfterCents =
    paidBeforeCents + (payment.kind === "refund" ? -thisAmountCents : thisAmountCents);
  const prevBalanceCents = Math.max(0, totals.totalCents - paidBeforeCents);
  const newBalanceCents = Math.max(0, totals.totalCents - paidAfterCents);

  return (
    <div className="mx-auto max-w-3xl">
      <PrintToolbar
        backHref={`/admin/facturacion/${invoice.id}`}
        backLabel={`Volver a Factura ${invoice.code}`}
        docTitle={`${receiptCode}_${customerName.replace(/\s+/g, "_")}`}
      />

      <article className="print-sheet rounded-2xl border border-slate-200 bg-white p-8 text-slate-800 shadow-sm md:p-10">
        {/* Cabecera con Logo y Datos de Hally Rent a Car */}
        <header className="flex flex-col justify-between gap-6 border-b-2 border-[#0b2347] pb-6 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <img
              src="/logo-public-dark.png"
              alt={company.name || "Hally Rent a Car"}
              className="h-13 w-auto object-contain"
            />
            <p className="text-sm font-bold text-[#0b2347] pt-1">
              {company.legal_name || company.name || "Hally Rent a Car"}
            </p>
            {company.rnc && (
              <p className="text-xs text-slate-600">
                <strong>RNC:</strong> {company.rnc}
              </p>
            )}
            {company.address && <p className="text-xs text-slate-600">{company.address}</p>}
            {(company.phone || company.whatsapp_number) && (
              <p className="text-xs text-slate-600">
                <strong>Tel / WhatsApp:</strong> {company.phone || company.whatsapp_number}
              </p>
            )}
          </div>

          <div className="rounded-xl border-2 border-[#0b2347] bg-slate-50 p-4 text-right sm:min-w-[240px]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#229ed9]">
              COMPROBANTE INTERNO
            </p>
            <h1 className="mt-0.5 text-lg font-extrabold text-[#0b2347]">
              {KIND_TITLE[payment.kind] ?? "RECIBO DE PAGO"}
            </h1>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">N.º {receiptCode}</p>
            <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
              <strong>Fecha y Hora:</strong> {formatBusinessDateTime(payment.paid_at)}
            </p>
            <p className="text-xs font-bold text-emerald-700 mt-1">
              Importe: {m(thisAmountCents)}
            </p>
          </div>
        </header>

        {/* Cuerpo del Recibo */}
        <section className="my-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-bold uppercase text-slate-400">Recibimos de</span>
              <span className="font-bold text-slate-900 text-base">{customerName}</span>
              {customerDoc && <span className="block text-xs text-slate-600">RNC / Doc: {customerDoc}</span>}
            </div>

            <div>
              <span className="block text-xs font-bold uppercase text-slate-400">La suma de</span>
              <span className="font-extrabold text-emerald-700 text-xl">{m(thisAmountCents)}</span>
              <span className="block text-xs text-slate-600">
                Método: {METHOD_LABEL[payment.method as keyof typeof METHOD_LABEL] ?? payment.method}
                {payment.reference ? ` · Ref: ${payment.reference}` : ""}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <span className="block text-xs font-bold uppercase text-slate-400">Por concepto de</span>
            <p className="font-semibold text-slate-800 mt-0.5">
              Abono / Pago aplicado a la Factura <strong>{invoice.code}</strong>
              {reservation ? ` (Reserva ${reservation.code})` : ""}
              {vehicle ? ` · Vehículo ${vehicle.make} ${vehicle.model} ${vehicle.year} (${vehicle.plate})` : ""}
            </p>
            {payment.note && <p className="mt-1 text-xs text-slate-600">Nota: {payment.note}</p>}
          </div>
        </section>

        {/* Estado de Cuenta de la Factura tras este recibo */}
        <section className="my-6 rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Estado de Cuenta · Factura {invoice.code}
          </p>
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <span className="text-slate-500 block">Total Factura</span>
              <span className="text-sm font-bold text-slate-900">{m(totals.totalCents)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Balance Anterior</span>
              <span className="text-sm font-semibold text-slate-700">{m(prevBalanceCents)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Este Pago</span>
              <span className="text-sm font-bold text-emerald-700">{m(thisAmountCents)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Balance Restante</span>
              <span className="text-sm font-extrabold text-[#0b2347]">{m(newBalanceCents)}</span>
            </div>
          </div>
        </section>

        {/* Firmas */}
        <footer className="mt-12 grid grid-cols-2 gap-12 border-t border-slate-200 pt-8 text-center text-xs text-slate-500">
          <div>
            <div className="mx-auto mb-2 w-44 border-b border-slate-400 pt-8" />
            <p className="font-semibold text-slate-700">Cajero / Administración · {company.name || "Hally Rent a Car"}</p>
          </div>
          <div>
            <div className="mx-auto mb-2 w-44 border-b border-slate-400 pt-8" />
            <p className="font-semibold text-slate-700">Firma del Cliente · {customerName}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
