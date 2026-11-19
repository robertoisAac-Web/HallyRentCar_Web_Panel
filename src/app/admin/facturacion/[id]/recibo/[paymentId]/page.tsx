import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/permissions";
import { getInvoiceDetail } from "@/server/services/invoices";
import { formatMoney, toCents } from "@/lib/money";
import { formatBusinessDateTime } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/validators/finance";
import { PrintToolbar } from "@/components/admin/PrintToolbar";

const KIND_TITLE: Record<string, string> = {
  advance: "RECIBO DE ANTICIPO",
  payment: "RECIBO DE PAGO",
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

      <article className="print-sheet rounded-xl border border-neutral-200 bg-white p-8 text-neutral-900 shadow-xs md:p-10">
        {/* Cabecera sencilla con Logo */}
        <header className="flex flex-col justify-between gap-6 border-b border-neutral-300 pb-6 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <img
              src="/logo-public-dark.png"
              alt={company.name || "Hally Rent a Car"}
              className="h-13 w-auto object-contain mb-2"
            />
            <p className="text-sm font-bold text-neutral-900">
              {company.legal_name || company.name || "HALLY RENT A CAR E INVERSIONES S.R.L."}
            </p>
            {company.rnc && <p className="text-xs text-neutral-600">RNC: {company.rnc}</p>}
            {company.address && <p className="text-xs text-neutral-600 max-w-xs">{company.address}</p>}
            {(company.phone || company.whatsapp_number) && (
              <p className="text-xs text-neutral-600">
                Tel: {company.phone || company.whatsapp_number}
              </p>
            )}
          </div>

          <div className="text-left sm:text-right space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              {KIND_TITLE[payment.kind] ?? "RECIBO DE PAGO"}
            </h1>
            <p className="font-mono text-sm font-semibold text-neutral-900">N.º {receiptCode}</p>
            <p className="text-xs text-neutral-600">
              Fecha: {formatBusinessDateTime(payment.paid_at)}
            </p>
            <p className="pt-1 text-base font-bold text-neutral-900">
              Monto: {m(thisAmountCents)}
            </p>
          </div>
        </header>

        {/* Detalle del Recibo sin cajas de color */}
        <section className="my-6 space-y-4 border-b border-neutral-200 pb-6 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Recibimos de
              </span>
              <span className="font-bold text-neutral-900 text-base">{customerName}</span>
              {customerDoc && <span className="block text-xs text-neutral-600">RNC / Doc: {customerDoc}</span>}
            </div>

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Forma de pago
              </span>
              <span className="font-semibold text-neutral-900">
                {METHOD_LABEL[payment.method as keyof typeof METHOD_LABEL] ?? payment.method}
                {payment.bank_name ? ` · ${payment.bank_name}` : ""}
              </span>
              {payment.reference && (
                <span className="block text-xs text-neutral-600">Referencia: {payment.reference}</span>
              )}
            </div>
          </div>

          <div className="pt-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Concepto
            </span>
            <p className="font-medium text-neutral-900 mt-0.5">
              Pago aplicado a Factura <strong>{invoice.code}</strong>
              {reservation ? ` (Reserva ${reservation.code})` : ""}
              {vehicle ? ` · ${vehicle.make} ${vehicle.model} ${vehicle.year} (${vehicle.plate})` : ""}
            </p>
            {payment.note && <p className="mt-1 text-xs text-neutral-600">Nota: {payment.note}</p>}
          </div>
        </section>

        {/* Balance de la Factura */}
        <section className="my-6 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          <div>
            <span className="text-neutral-500 block">Total Factura</span>
            <span className="text-sm font-semibold text-neutral-900">{m(totals.totalCents)}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Balance Anterior</span>
            <span className="text-sm font-semibold text-neutral-900">{m(prevBalanceCents)}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Este Pago</span>
            <span className="text-sm font-bold text-neutral-900">{m(thisAmountCents)}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Balance Restante</span>
            <span className="text-sm font-bold text-neutral-900">{m(newBalanceCents)}</span>
          </div>
        </section>

        {/* Firmas */}
        <footer className="mt-14 grid grid-cols-2 gap-12 pt-8 text-center text-xs text-neutral-500">
          <div>
            <div className="mx-auto mb-2 w-44 border-b border-neutral-400" />
            <p className="font-medium text-neutral-700">{company.name || "Hally Rent a Car"}</p>
          </div>
          <div>
            <div className="mx-auto mb-2 w-44 border-b border-neutral-400" />
            <p className="font-medium text-neutral-700">{customerName}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
