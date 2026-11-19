import { requirePermission } from "@/server/auth/permissions";
import { getCompany } from "@/server/services/company";
import { PrintToolbar } from "@/components/admin/PrintToolbar";

export default async function SampleInvoicePdfPage() {
  await requirePermission("payments:read");
  const company = await getCompany();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900">
        <strong>Vista previa de demostración:</strong> Así es exactamente como sale el formato de Factura en PDF de Hally Rent a Car (este ejemplo no afecta tu base de datos real).
      </div>

      <PrintToolbar
        backHref="/admin/facturacion"
        backLabel="Volver a Facturación"
        docTitle="FAC-2026-0001_Ejemplo_HallyRentCar"
      />

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
              {company.legal_name || "HALLY RENT A CAR E INVERSIONES S.R.L."}
            </p>
            <p className="text-xs text-slate-600">
              <strong>RNC:</strong> {company.rnc || "133683687"}
            </p>
            <p className="text-xs text-slate-600 max-w-xs">
              {company.address ||
                "Calle de Febrero, Edif. 2, Res. Quintas Jeremy Francisco del Rosario Sánchez #27, Sector Los Frailes, Santo Domingo Este"}
            </p>
            <p className="text-xs text-slate-600">
              <strong>Tel / WhatsApp:</strong> {company.phone || company.whatsapp_number || "809-854-9733"}
            </p>
          </div>

          <div className="rounded-xl border-2 border-[#0b2347] bg-slate-50 p-4 text-right sm:min-w-[270px]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#229ed9]">
              E32 · CONSUMO ELECTRÓNICO (e-CF) / CONTROL INTERNO
            </p>
            <h1 className="mt-0.5 text-xl font-extrabold text-[#0b2347]">
              FACTURA DE ALQUILER
            </h1>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">
              N.º FAC-2026-0001
            </p>

            <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700 space-y-0.5">
              <p>
                <strong>Modalidad:</strong>{" "}
                <span className="font-semibold">Factura Interna / Lista para e-CF DGII</span>
              </p>
              <p>
                <strong>Cód. Seguridad Firma .p12:</strong>{" "}
                <span className="font-mono font-bold">A9F4C2</span>
              </p>
            </div>

            <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
              <p>
                <strong>Fecha Emisión:</strong> 2026-11-19
              </p>
              <p>
                <strong>Fecha Vencimiento:</strong> 2026-11-23
              </p>
              <p className="mt-1 font-bold text-emerald-700">
                Estado: PAGADA
              </p>
            </div>
          </div>
        </header>

        {/* Datos del Cliente y del Alquiler/Vehículo */}
        <section className="my-6 grid gap-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-slate-400">Facturado a</p>
            <p className="text-sm font-bold text-slate-900">Carlos Manuel Jiménez</p>
            <p>
              <strong>RNC / Cédula / Pasaporte:</strong> 001-1458923-7
            </p>
            <p>
              <strong>Teléfono:</strong> 809-555-0192
            </p>
            <p>
              <strong>Correo:</strong> c.jimenez@ejemplo.do
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider text-slate-400">Detalles del Alquiler / Referencia</p>
            <p>
              <strong>Origen:</strong> Reserva RES-2026-0001
            </p>
            <p>
              <strong>Vehículo:</strong> Honda CR-V HYBRID 2026 · Placa{" "}
              <span className="font-mono font-bold">D231456</span>
            </p>
            <p>
              <strong>Entrega:</strong> 19/11/2026 10:00 a. m. (Aeropuerto Las Américas - AILA)
            </p>
            <p>
              <strong>Devolución:</strong> 23/11/2026 10:00 a. m. (Aeropuerto Las Américas - AILA)
            </p>
            <p>
              <strong>Moneda:</strong> Dólares Estadounidenses (US$)
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
              <tr>
                <td className="py-3 px-3 font-medium text-slate-900">
                  Alquiler de Honda CR-V HYBRID 2026 (Placa D231456) · 4 días completos
                </td>
                <td className="py-3 px-3 text-center text-slate-700">4</td>
                <td className="py-3 px-3 text-right text-slate-700">US$ 80.00</td>
                <td className="py-3 px-3 text-right font-semibold text-slate-900">US$ 320.00</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium text-slate-900">
                  Entrega y recogida en Aeropuerto Internacional Las Américas (AILA)
                </td>
                <td className="py-3 px-3 text-center text-slate-700">1</td>
                <td className="py-3 px-3 text-right text-slate-700">US$ 20.00</td>
                <td className="py-3 px-3 text-right font-semibold text-slate-900">US$ 20.00</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Totales y Balance */}
        <section className="grid gap-6 border-t-2 border-slate-200 pt-6 sm:grid-cols-2">
          <div className="space-y-3 text-xs text-slate-600">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-bold text-slate-800 mb-1">Notas y Condiciones:</p>
              <p>Vehículo entregado con tanque lleno (8/8) y limpio. Incluye asistencia vial 24/7.</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="font-bold text-slate-800 mb-1.5">Pagos / Recibos Aplicados (Pago Mixto):</p>
              <ul className="space-y-1 text-[11px]">
                <li className="flex justify-between">
                  <span>REC-2026-0001 · 19/11/2026 (Efectivo en Caja CAJ-2026-0001)</span>
                  <span className="font-semibold">US$ 140.00</span>
                </li>
                <li className="flex justify-between">
                  <span>REC-2026-0002 · 19/11/2026 (Transferencia · Banreservas Ref #948271)</span>
                  <span className="font-semibold">US$ 200.00</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">US$ 340.00</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>ITBIS (0%):</span>
                <span className="font-semibold text-slate-900">US$ 0.00</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-extrabold text-[#0b2347]">
                <span>TOTAL FACTURADO:</span>
                <span>US$ 340.00</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Monto Pagado / Abonado:</span>
                <span>- US$ 340.00</span>
              </div>
              <div className="flex justify-between border-t-2 border-[#0b2347] pt-2 text-sm font-extrabold text-slate-900">
                <span>BALANCE PENDIENTE:</span>
                <span>US$ 0.00</span>
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
            <p className="font-semibold text-slate-700">Recibido conforme · Carlos Manuel Jiménez</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
