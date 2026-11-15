import { requirePermission } from "@/server/auth/permissions";
import { getCompany } from "@/server/services/company";
import {
  getDgiiSettings,
  listDgiiSequences,
} from "@/server/services/dgii-ecf";
import { formatBusinessDateTime } from "@/lib/dates";
import { Badge, ErrorBox, OkBox, PageHeader } from "@/components/admin/ui";
import {
  updateCompanyAction,
  updateDgiiSettingsAction,
  createDgiiSequenceAction,
  toggleDgiiSequenceAction,
} from "./actions";

const SEQ_TYPE_LABEL: Record<string, string> = {
  E31: "E31 · Crédito Fiscal Electrónico (e-CF)",
  E32: "E32 · Consumo Electrónico (e-CF)",
  E33: "E33 · Nota de Débito Electrónica (e-CF)",
  E34: "E34 · Nota de Crédito Electrónica (e-CF)",
  E44: "E44 · Regímenes Especiales Electrónico (e-CF)",
  E45: "E45 · Gubernamental Electrónico (e-CF)",
  B01: "B01 · Crédito Fiscal (NCF Tradicional)",
  B02: "B02 · Consumo Final (NCF Tradicional)",
  B14: "B14 · Regímenes Especiales (NCF)",
  B15: "B15 · Gubernamental (NCF)",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requirePermission("company:manage");
  const { error, ok } = await searchParams;
  const [c, dgii, sequences] = await Promise.all([
    getCompany(),
    getDgiiSettings(),
    listDgiiSequences(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configuración de la empresa y Facturación DGII"
        subtitle="Estos datos alimentan la web pública, los contratos, la facturación electrónica e-CF y las secuencias fiscales."
      />
      <ErrorBox error={error} />
      <OkBox ok={ok} error={error} />

      <form action={updateCompanyAction} className="max-w-4xl space-y-8">
        <section className="panel space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Identidad del negocio y Registro Mercantil</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Información general, RNC y datos fiscales de Hally Rent a Car e Inversiones S.R.L.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Nombre comercial *
            </label>
            <input name="name" required defaultValue={c.name} className="input" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Razón social (DGII / Registro Mercantil)
              </label>
              <input name="legal_name" defaultValue={c.legal_name ?? ""} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                RNC
              </label>
              <input name="rnc" defaultValue={c.rnc ?? ""} className="input font-mono font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Teléfono fijo
              </label>
              <input name="phone" defaultValue={c.phone ?? ""} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                WhatsApp comercial
              </label>
              <input
                name="whatsapp_number"
                placeholder="809 555 1234"
                defaultValue={c.whatsapp_number ?? ""}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Dirección física / Domicilio Fiscal
            </label>
            <input name="address" defaultValue={c.address ?? ""} className="input" />
          </div>
        </section>

        <section className="panel space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Presencia pública</h2>
            <p className="text-xs text-slate-500 mt-0.5">Visibilidad del catálogo y condiciones del servicio ofrecido.</p>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 cursor-pointer">
            <input
              type="checkbox"
              name="public_enabled"
              defaultChecked={c.public_enabled}
              className="h-4 w-4 rounded border-slate-300 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
            />
            <div>
              <p className="text-sm font-semibold text-slate-800">Mostrar la web pública</p>
              <p className="text-xs text-slate-500">Permite a los clientes ver vehículos y solicitar reservas en línea.</p>
            </div>
          </label>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Frase principal (Slogan)
            </label>
            <input
              name="tagline"
              defaultValue={c.tagline ?? ""}
              placeholder="Ej: Alquila tu vehículo cerca del aeropuerto"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Zonas de entrega
            </label>
            <input
              name="delivery_zones"
              defaultValue={c.delivery_zones ?? ""}
              placeholder="Ej: Aeropuerto Las Américas, Santo Domingo Este"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Términos y condiciones
            </label>
            <textarea
              name="terms_text"
              rows={6}
              defaultValue={c.terms_text ?? ""}
              className="input"
            />
          </div>
        </section>

        <section className="panel space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Reglas de alquiler y cobro</h2>
            <p className="text-xs text-slate-500 mt-0.5">Parámetros de cálculo de días facturables y tiempos entre reservas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Gracia (min)
              </label>
              <input
                name="grace_minutes"
                type="number"
                min={0}
                required
                defaultValue={c.grace_minutes}
                className="input"
              />
              <p className="mt-1 text-[11px] text-slate-400">Tolerancia antes de cobrar un día extra.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Margen entre alquileres (min)
              </label>
              <input
                name="turnaround_minutes"
                type="number"
                min={0}
                required
                defaultValue={c.turnaround_minutes}
                className="input"
              />
              <p className="mt-1 text-[11px] text-slate-400">Tiempo de limpieza y preparación.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Expiración de solicitudes (h)
              </label>
              <input
                name="pending_expiry_hours"
                type="number"
                min={1}
                required
                defaultValue={c.pending_expiry_hours}
                className="input"
              />
              <p className="mt-1 text-[11px] text-slate-400">Horas antes de auto-cancelar si no se revisa.</p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            name="return_to_home"
            value="1"
            className="btn btn-secondary"
          >
            Guardar e ir a Inicio
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar datos de la empresa
          </button>
        </div>
      </form>

      {/* =====================================================================
          SECCIÓN DGII: CERTIFICADO .P12, AMBIENTE Y WEB SERVICES
          ===================================================================== */}
      <section id="dgii" className="panel max-w-4xl space-y-5 border-slate-300">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Facturación Electrónica DGII (Certificado Digital .p12 y Web Services)
              </h2>
              <Badge tone={dgii.has_p12_certificate ? "green" : "amber"}>
                {dgii.has_p12_certificate
                  ? `Certificado cargado (${dgii.p12_file_name})`
                  : "Pendiente cargar certificado .p12"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Carga aquí el archivo <span className="font-mono font-semibold">.p12 / .pfx</span> cuando te lo entregue Viafirma o Digifirma, y selecciona el ambiente de operación de la DGII.
            </p>
          </div>
        </div>

        {/* Rutas listas para copiar en el Portal de Certificación de la DGII */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
          <p className="font-bold text-slate-800 uppercase tracking-wider">
            URLs Oficiales de Software Propio (Para copiar en el Portal de Certificación DGII - CerteCF)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-2.5 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">1. URL Autenticación (Semilla · GET)</span>
              <code className="font-mono text-[11px] text-slate-900 select-all break-all">
                https://hallyrentcar.vercel.app/fe/autenticacion/api/semilla
              </code>
            </div>
            <div className="rounded-lg bg-white p-2.5 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">2. URL Validación Semilla (POST)</span>
              <code className="font-mono text-[11px] text-slate-900 select-all break-all">
                https://hallyrentcar.vercel.app/fe/autenticacion/api/validacioncertificado
              </code>
            </div>
            <div className="rounded-lg bg-white p-2.5 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">3. URL Recepción de e-CF / Acuse ARECF (POST)</span>
              <code className="font-mono text-[11px] text-slate-900 select-all break-all">
                https://hallyrentcar.vercel.app/fe/recepcion/api/ecf
              </code>
            </div>
            <div className="rounded-lg bg-white p-2.5 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">4. URL Aprobación Comercial ACECF (POST)</span>
              <code className="font-mono text-[11px] text-slate-900 select-all break-all">
                https://hallyrentcar.vercel.app/fe/aprobacioncomercial/api/ecf
              </code>
            </div>
          </div>
        </div>

        <form action={updateDgiiSettingsAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-700">
              Ambiente DGII *
              <select name="environment" defaultValue={dgii.environment} className="input mt-1">
                <option value="TesteCF">TesteCF (Pre-Certificación / Simulación)</option>
                <option value="CerteCF">CerteCF (Certificación Set de Pruebas DGII)</option>
                <option value="eCF">eCF (Producción DGII Oficial)</option>
              </select>
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Modalidad de Conexión *
              <select name="integration_mode" defaultValue={dgii.integration_mode} className="input mt-1">
                <option value="direct_dgii">Conexión Directa Web Services DGII (Software Propio)</option>
                <option value="psfe">Vía Proveedor Autorizado (PSFE: Alanube / DigiFact)</option>
              </select>
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              ITBIS por defecto (%) *
              <input
                name="default_tax_rate"
                type="number"
                step="0.01"
                min={0}
                max={100}
                defaultValue={dgii.default_tax_rate}
                className="input mt-1"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Archivo de Certificado Digital (.p12 o .pfx)
                <input
                  type="file"
                  name="p12_file"
                  accept=".p12,.pfx"
                  className="input mt-1 bg-white text-xs"
                />
              </label>
              {dgii.has_p12_certificate && (
                <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                  ✓ Certificado actual: {dgii.p12_file_name}{" "}
                  {dgii.p12_uploaded_at ? `(${formatBusinessDateTime(dgii.p12_uploaded_at)})` : ""}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Contraseña / PIN del Certificado .p12
                <input
                  type="password"
                  name="p12_password"
                  placeholder={
                    dgii.has_p12_password
                      ? "•••••••• (Ya guardada · escribe para actualizar)"
                      : "Ingresa la clave PIN de tu certificado .p12"
                  }
                  className="input mt-1 bg-white"
                />
              </label>
              <p className="mt-1 text-[11px] text-slate-500">
                Se utiliza en el servidor para firmar los XML &lt;SemillaModel&gt; y &lt;ECF&gt;.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 cursor-pointer">
            <input
              type="checkbox"
              name="auto_assign_sequence"
              defaultChecked={dgii.auto_assign_sequence}
              className="h-4 w-4 rounded border-slate-300 text-[var(--color-brand)]"
            />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Asignar automáticamente el siguiente NCF / e-NCF al crear facturas fiscales
              </p>
              <p className="text-xs text-slate-500">
                Si seleccionas B01, B02, E31 o E32 en una factura y tienes una secuencia activa registrada abajo, el sistema tomará el próximo correlativo automáticamente. Si no hay secuencia registrada, mantendrá la factura como Factura Interna.
              </p>
            </div>
          </label>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary">
              Guardar Configuración Fiscal DGII
            </button>
          </div>
        </form>
      </section>

      {/* =====================================================================
          SECCIÓN SECUENCIAS NCF / e-NCF AUTORIZADAS POR LA DGII
          ===================================================================== */}
      <section id="dgii-secuencias" className="panel max-w-4xl space-y-5 border-slate-300">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Secuencias de Comprobantes Autorizadas (e-NCF Serie E y NCF Serie B)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cuando la DGII les autorice los rangos en la Oficina Virtual (OFV), regístralos aquí para que el sistema lleve el conteo correlativo y la fecha de vencimiento automáticamente.
          </p>
        </div>

        {sequences.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
            <strong>Modo Factura Interna Activo:</strong> Todavía no has cargado ningún rango de secuencias de la DGII. Todas las facturas se emiten de forma segura como <strong>Factura Interna</strong> sin inventar números fiscales.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Rango Autorizado</th>
                  <th>Próximo a Emitir</th>
                  <th>Disponibles</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((s) => {
                  const pad = (n: number) => `${s.prefix}${String(n).padStart(s.padding_length, "0")}`;
                  const remaining = Math.max(0, s.end_number - s.current_number);
                  const nextFormatted = remaining > 0 ? pad(s.current_number + 1) : "Agotado";
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="font-mono font-bold text-slate-900">{s.fiscal_type}</span>
                        <span className="block text-[11px] text-slate-500">
                          {SEQ_TYPE_LABEL[s.fiscal_type] ?? s.fiscal_type}
                        </span>
                      </td>
                      <td className="font-mono text-xs">
                        {pad(s.start_number)} → {pad(s.end_number)}
                      </td>
                      <td className="font-mono text-xs font-bold text-emerald-700">{nextFormatted}</td>
                      <td className="font-semibold">{remaining}</td>
                      <td className="text-xs">{s.expiration_date ?? "Sin vencimiento"}</td>
                      <td>
                        {remaining === 0 ? (
                          <Badge tone="red">Agotada</Badge>
                        ) : s.is_active ? (
                          <Badge tone="green">Activa</Badge>
                        ) : (
                          <Badge tone="gray">Pausada</Badge>
                        )}
                      </td>
                      <td>
                        <form action={toggleDgiiSequenceAction.bind(null, s.id, !s.is_active)}>
                          <button type="submit" className="btn btn-secondary btn-sm">
                            {s.is_active ? "Pausar" : "Activar"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form
          action={createDgiiSequenceAction}
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
            + Registrar nuevo rango de secuencia autorizado por la DGII
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block text-xs font-semibold text-slate-700 lg:col-span-2">
              Tipo de Comprobante *
              <select name="fiscal_type" defaultValue="E32" className="input mt-1 bg-white">
                {Object.entries(SEQ_TYPE_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Desde número *
              <input
                name="start_number"
                type="number"
                min={1}
                required
                defaultValue={1}
                placeholder="1"
                className="input mt-1 bg-white font-mono"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Hasta número *
              <input
                name="end_number"
                type="number"
                min={1}
                required
                defaultValue={100}
                placeholder="100"
                className="input mt-1 bg-white font-mono"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Próximo a usar
              <input
                name="next_number"
                type="number"
                min={1}
                placeholder="1"
                className="input mt-1 bg-white font-mono"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
            <div className="grid gap-3 sm:grid-cols-2 flex-1 min-w-[260px]">
              <label className="block text-xs font-semibold text-slate-700">
                Fecha de vencimiento de secuencia (Si aplica)
                <input type="date" name="expiration_date" className="input mt-1 bg-white" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                No. de Autorización OFV DGII (Opcional)
                <input
                  name="authorization_number"
                  placeholder="Ej: 8001234567"
                  className="input mt-1 bg-white font-mono"
                />
              </label>
            </div>

            <button type="submit" className="btn btn-primary">
              Guardar Secuencia DGII
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
