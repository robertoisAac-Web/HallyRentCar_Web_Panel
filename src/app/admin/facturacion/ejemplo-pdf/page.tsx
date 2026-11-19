import { requirePermission } from "@/server/auth/permissions";
import { getCompany } from "@/server/services/company";
import { PrintToolbar } from "@/components/admin/PrintToolbar";
import { DgiiQrStamp } from "@/components/admin/DgiiQrStamp";

export default async function SampleInvoicePdfPage() {
  await requirePermission("payments:read");
  const company = await getCompany();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-700">
        <strong>Vista previa de demostración:</strong> Formato limpio y minimalista de Factura con el logo de Hally Rent a Car.
      </div>

      <PrintToolbar
        backHref="/admin/facturacion"
        backLabel="Volver a Facturación"
        docTitle="FAC-2026-0001_Ejemplo_HallyRentCar"
      />

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
              {company.legal_name || "HALLY RENT A CAR E INVERSIONES S.R.L."}
            </p>
            <p className="text-xs text-neutral-600">
              RNC: <span className="font-medium text-neutral-900">{company.rnc || "133683687"}</span>
            </p>
            <p className="text-xs text-neutral-600 max-w-xs leading-relaxed">
              {company.address ||
                "Calle de Febrero, Edif. 2, Res. Quintas Jeremy #27, Sector Los Frailes, Santo Domingo Este"}
            </p>
            <p className="text-xs text-neutral-600">
              Tel: {company.phone || company.whatsapp_number || "809-854-9733"}
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">FACTURA</h1>
            <p className="font-mono text-sm font-semibold text-neutral-900">N.º FAC-2026-0001</p>
            <p className="text-xs text-neutral-500">Documento de control interno</p>
            <div className="pt-2 text-xs text-neutral-600 space-y-0.5">
              <p>
                Fecha: <span className="text-neutral-900 font-medium">2026-11-19</span>
              </p>
              <p>
                Vence: <span className="text-neutral-900 font-medium">2026-11-23</span>
              </p>
              <p>
                Estado: <span className="text-neutral-900 font-semibold">Pagada</span>
              </p>
            </div>
          </div>
        </header>

        {/* Datos del Cliente y del Vehículo (Sin cajas de color) */}
        <section className="my-7 grid gap-8 border-b border-neutral-200 pb-7 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Cliente
            </p>
            <p className="text-sm font-bold text-neutral-900">Carlos Manuel Jiménez</p>
            <p className="text-neutral-600">RNC / Cédula / Doc: 001-1458923-7</p>
            <p className="text-neutral-600">Teléfono: 809-555-0192</p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Detalle del Alquiler
            </p>
            <p className="text-neutral-700">
              Contrato / Reserva: <span className="font-semibold text-neutral-900">RES-2026-0001</span>
            </p>
            <p className="text-neutral-700">
              Vehículo:{" "}
              <span className="font-semibold text-neutral-900">Honda CR-V HYBRID 2026</span> (Placa D231456)
            </p>
            <p className="text-neutral-600">Entrega: 19/11/2026 10:00 a. m. · Aeropuerto AILA</p>
            <p className="text-neutral-600">Devolución: 23/11/2026 10:00 a. m. · Aeropuerto AILA</p>
          </div>
        </section>

        {/* Tabla de Conceptos Limpia */}
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
              <tr>
                <td className="py-3.5 pr-3 text-neutral-900">
                  Alquiler de Honda CR-V HYBRID 2026 (Placa D231456) · 4 días
                </td>
                <td className="py-3.5 px-3 text-center text-neutral-700">4</td>
                <td className="py-3.5 px-3 text-right text-neutral-700">US$ 80.00</td>
                <td className="py-3.5 pl-3 text-right font-semibold text-neutral-900">US$ 320.00</td>
              </tr>
              <tr>
                <td className="py-3.5 pr-3 text-neutral-900">
                  Entrega y recogida en Aeropuerto Internacional Las Américas (AILA)
                </td>
                <td className="py-3.5 px-3 text-center text-neutral-700">1</td>
                <td className="py-3.5 px-3 text-right text-neutral-700">US$ 20.00</td>
                <td className="py-3.5 pl-3 text-right font-semibold text-neutral-900">US$ 20.00</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Totales y Pagos */}
        <section className="mt-8 grid gap-8 border-t border-neutral-300 pt-6 sm:grid-cols-2">
          <div className="space-y-4 text-xs text-neutral-600">
            <div className="space-y-1.5">
              <p className="font-semibold text-neutral-900">Pagos recibidos:</p>
              <ul className="space-y-1 text-[11px]">
                <li className="flex justify-between border-b border-neutral-100 pb-1">
                  <span>REC-2026-0001 · 19/11/2026 (Efectivo)</span>
                  <span className="font-medium text-neutral-900">US$ 140.00</span>
                </li>
                <li className="flex justify-between border-b border-neutral-100 pb-1">
                  <span>REC-2026-0002 · 19/11/2026 (Transferencia - Banreservas)</span>
                  <span className="font-medium text-neutral-900">US$ 200.00</span>
                </li>
              </ul>
            </div>

            <DgiiQrStamp
              rncEmisor={company.rnc || "133683687"}
              rncComprador="00114589237"
              encf="FAC-2026-0001"
              fechaEmision="2026-11-19"
              montoTotal="340.00"
              fechaFirma="19-11-2026 10:00:00"
              codigoSeguridad="A9F4C2"
              isFiscal={false}
            />
          </div>

          <div className="flex flex-col items-end">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="font-medium text-neutral-900">US$ 340.00</span>
              </div>
              <div className="flex justify-between border-t border-neutral-300 pt-2 text-sm font-bold text-neutral-900">
                <span>Total</span>
                <span>US$ 340.00</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Pagado</span>
                <span>US$ 340.00</span>
              </div>
              <div className="flex justify-between border-t border-neutral-900 pt-2 text-sm font-bold text-neutral-900">
                <span>Balance Pendiente</span>
                <span>US$ 0.00</span>
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
            <p className="font-medium text-neutral-700">Carlos Manuel Jiménez</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
