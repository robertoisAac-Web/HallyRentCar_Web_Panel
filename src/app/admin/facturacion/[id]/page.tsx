import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import {
  getInvoiceDetail,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  FISCAL_TYPE_LABEL,
} from "@/server/services/invoices";
import {
  listBankAccounts,
  getActiveShiftForCurrentUser,
} from "@/server/services/cash-and-banks";
import {
  listEcfSubmissionsForInvoice,
  DGII_WS_ENDPOINTS,
} from "@/server/services/dgii-ecf";
import { formatMoney, toCents } from "@/lib/money";
import { formatBusinessDateTime } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/validators/finance";
import { whatsappLink } from "@/lib/whatsapp";
import { Badge, ErrorBox, OkBox } from "@/components/admin/ui";
import { MixedPaymentForm } from "@/components/admin/MixedPaymentForm";
import {
  recordInvoicePaymentAction,
  generateEcfXmlAction,
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

  const [detail, bankAccounts, activeShift, ecfSubmissions] = await Promise.all([
    getInvoiceDetail(id),
    listBankAccounts(true),
    getActiveShiftForCurrentUser(),
    listEcfSubmissionsForInvoice(id),
  ]);
  if (!detail) notFound();

  const { invoice, items, customer, vehicle, reservation, payments, totals, company } = detail;
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
            <h2>Pagos, Cobros Mixtos y Recibos de Ingreso</h2>
            <p className="text-xs text-slate-500">
              Soporta pagos individuales o mixtos (Efectivo en Caja + Transferencia Bancaria) y genera recibos numerados en PDF.
            </p>
          </div>
          <Link href="/admin/caja" className="text-xs font-semibold text-emerald-700 hover:underline">
            Ir a Control de Caja y Conciliación →
          </Link>
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
                  <th>Método / Banco / Ref.</th>
                  <th>Importe</th>
                  <th>Recibo PDF</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                    <td className="font-mono font-semibold text-xs text-slate-900">
                      {p.receipt_number ?? `REC-${p.id.slice(0, 6).toUpperCase()}`}
                      {p.payment_group_id && (
                        <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                          Mixto
                        </span>
                      )}
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
                      <span className="font-medium text-slate-800">
                        {METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] ?? p.method}
                      </span>
                      {p.bank_name ? (
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          {p.bank_name}
                        </span>
                      ) : null}
                      {p.reference ? ` · Ref: ${p.reference}` : ""}
                      {p.reconciled_at && (
                        <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Conciliado
                        </span>
                      )}
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
          <MixedPaymentForm
            action={recordInvoicePaymentAction.bind(null, invoice.id)}
            currency={invoice.currency}
            balanceCents={totals.balanceCents}
            canVoid={canVoid}
            bankAccounts={bankAccounts}
            activeShiftCode={activeShift?.shift.code ?? null}
          />
        )}
      </section>

      {/* Arquitectura de Facturación Electrónica DGII (e-CF · XML E31/E32, Firma Digital y Web Services) */}
      <section className="panel space-y-4 border-slate-300">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2>Facturación Electrónica DGII (e-CF · XML Oficial)</h2>
              <Badge tone={invoice.document_scope === "fiscal_ecf" ? "green" : "amber"}>
                {invoice.document_scope === "fiscal_ecf"
                  ? "Comprobante e-CF"
                  : "Modo Factura Interna (Pre-Certificación DGII)"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Estructura técnica lista para emisión de <span className="font-semibold">E31 (Crédito Fiscal)</span> y{" "}
              <span className="font-semibold">E32 (Consumo)</span>, firma digital XAdES-EPES (.p12) y Web Services DGII.
              Mientras no ingreses una secuencia e-NCF autorizada, el sistema mantiene la factura como{" "}
              <span className="font-semibold">Factura Interna</span> sin inventar comprobantes ficticios.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs sm:grid-cols-3">
          <div>
            <span className="text-slate-500 block">Emisor (RNC Empresa)</span>
            <span className="font-mono font-bold text-slate-900">
              {company.rnc || "Pendiente configurar RNC en Configuración"}
            </span>
            <span className="block text-[11px] text-slate-500">
              {company.legal_name || company.name}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Comprador (RNC / Cédula)</span>
            <span className="font-mono font-bold text-slate-900">
              {customerDoc || "Consumidor Final (Sin RNC)"}
            </span>
            <span className="block text-[11px] text-slate-500">{customerName}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Endpoints Web Services DGII</span>
            <span className="font-mono text-[11px] text-slate-700 block truncate" title={DGII_WS_ENDPOINTS.TesteCF.recepcionEcf}>
              Pre-Cert: TesteCF / CerteCF
            </span>
            <span className="text-[11px] text-emerald-700 font-medium">
              Semilla → Firma .p12 → Recepción e-CF
            </span>
          </div>
        </div>

        {canWrite && !invoice.voided_at && (
          <form
            action={generateEcfXmlAction.bind(null, invoice.id)}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Generar / Actualizar XML Estándar e-CF v1.0
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-slate-700">
                Tipo de e-CF DGII *
                <select
                  name="ecf_tipo"
                  defaultValue={
                    invoice.fiscal_type === "E31" ||
                    invoice.fiscal_type === "E32" ||
                    invoice.fiscal_type === "E44" ||
                    invoice.fiscal_type === "E45"
                      ? invoice.fiscal_type
                      : customerDoc && customerDoc.replace(/\D/g, "").length === 9
                        ? "E31"
                        : "E32"
                  }
                  className="input mt-1"
                >
                  <option value="E31">E31 · Factura de Crédito Fiscal Electrónica</option>
                  <option value="E32">E32 · Factura de Consumo Electrónica</option>
                  <option value="E44">E44 · Regímenes Especiales Electrónico</option>
                  <option value="E45">E45 · Gubernamental Electrónico</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Ambiente DGII *
                <select name="environment" defaultValue="TesteCF" className="input mt-1">
                  <option value="TesteCF">TesteCF (Pre-Certificación / Pruebas)</option>
                  <option value="CerteCF">CerteCF (Certificación DGII)</option>
                  <option value="eCF">eCF (Producción DGII)</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Secuencia e-NCF Autorizada (Opcional)
                <input
                  name="e_ncf"
                  defaultValue={
                    invoice.ncf_or_ecf && invoice.ncf_or_ecf.toUpperCase().startsWith("E")
                      ? invoice.ncf_or_ecf
                      : ""
                  }
                  placeholder="Dejar vacío si es Factura Interna"
                  className="input mt-1 font-mono"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Vencimiento Secuencia (Opcional)
                <input
                  type="date"
                  name="expiration_date"
                  defaultValue={invoice.ncf_expiration_date ?? ""}
                  className="input mt-1"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-slate-500">
                Si dejas la secuencia e-NCF vacía, se generará el XML técnico para validación y pruebas sin alterar la condición de Factura Interna.
              </p>
              <button type="submit" className="btn btn-secondary btn-sm">
                Generar XML e-CF DGII
              </button>
            </div>
          </form>
        )}

        {ecfSubmissions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Comprobantes XML e-CF Generados ({ecfSubmissions.length})
            </h3>
            {ecfSubmissions.map((sub) => {
              const sha256Hash =
                sub.dgii_response && typeof sub.dgii_response === "object" && "xml_sha256" in sub.dgii_response
                  ? String(sub.dgii_response.xml_sha256)
                  : null;
              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {sub.ecf_type}
                      </span>
                      <Badge tone={sub.dgii_status === "accepted" || sub.dgii_status === "signed" ? "green" : "blue"}>
                        {sub.dgii_status === "signed"
                          ? "Firmado Digitalmente con .p12 (XMLDSig)"
                          : sub.dgii_status === "draft_xml"
                            ? "XML Generado · Listo para Firma .p12"
                            : sub.dgii_status}
                      </Badge>
                      <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] border border-slate-200">
                        Ambiente: {sub.environment}
                      </span>
                      <span className="text-slate-500">
                        {sub.encf ? `e-NCF: ${sub.encf}` : "Simulación Interna (Sin e-NCF fiscal)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/v1/facturacion/ecf?invoiceId=${invoice.id}&submissionId=${sub.id}&download=1`}
                        className="btn btn-primary btn-sm"
                      >
                        Descargar XML ({sub.ecf_type})
                      </a>
                    </div>
                  </div>

                  <div className="grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                    <div>
                      <span className="font-semibold text-slate-700">Código Seguridad (6 dígitos):</span>{" "}
                      <span className="font-mono">{sub.security_code ?? "Pendiente firma .p12"}</span>
                    </div>
                    <div className="sm:col-span-2 truncate">
                      <span className="font-semibold text-slate-700">Digest SHA-256:</span>{" "}
                      <span className="font-mono">{sha256Hash ?? "—"}</span>
                    </div>
                  </div>

                  <details className="pt-1">
                    <summary className="cursor-pointer font-semibold text-slate-700 hover:text-slate-900">
                      Ver estructura XML &lt;ECF&gt; {sub.xml_signed ? "firmada con .p12" : "generada"}
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
                      {sub.xml_signed || sub.xml_unsigned}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
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
