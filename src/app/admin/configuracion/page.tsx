import { requirePermission } from "@/server/auth/permissions";
import { getCompany } from "@/server/services/company";
import { ErrorBox, OkBox, PageHeader } from "@/components/admin/ui";
import { updateCompanyAction } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requirePermission("company:manage");
  const { error, ok } = await searchParams;
  const c = await getCompany();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configuración de la empresa"
        subtitle="Estos datos alimentan la web pública, los contratos y las reglas operativas de cobro."
      />
      <ErrorBox error={error} />
      <OkBox ok={ok} error={error} />

      <form action={updateCompanyAction} className="max-w-3xl space-y-8">
        <section className="panel space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Identidad del negocio</h2>
            <p className="text-xs text-slate-500 mt-0.5">Información general y datos de contacto directo con clientes.</p>
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
                Razón social
              </label>
              <input name="legal_name" defaultValue={c.legal_name ?? ""} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                RNC
              </label>
              <input name="rnc" defaultValue={c.rnc ?? ""} className="input" />
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
              Dirección física
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

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="submit"
            name="return_to_home"
            value="1"
            className="btn btn-secondary"
          >
            Guardar e ir a Inicio
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  );
}
