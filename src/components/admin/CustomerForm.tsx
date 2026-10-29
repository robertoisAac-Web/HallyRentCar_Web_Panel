import type { CustomerRow } from "@/server/services/customers";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { inputCls } from "./ui";

export function CustomerForm({ action, customer, submitLabel }: {
  action: (fd: FormData) => void | Promise<void>; customer?: CustomerRow; submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-8">
      <section className="panel space-y-4">
        <h2 className="font-medium">Datos personales</h2>
        <label className="block text-sm">Nombre completo *<input name="full_name" required defaultValue={customer?.full_name} className={inputCls} /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Teléfono<input name="phone" defaultValue={customer?.phone ?? ""} className={inputCls} /></label>
          <label className="text-sm">Correo<input name="email" type="email" defaultValue={customer?.email ?? ""} className={inputCls} /></label>
          <label className="text-sm">País de residencia<input name="country" defaultValue={customer?.country ?? ""} className={inputCls} /></label>
        </div>
      </section>
      <section className="panel space-y-4">
        <h2 className="font-medium">Identificación y licencia</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Tipo de identificación
            <select name="id_type" defaultValue={customer?.id_type ?? ""} className={inputCls}>
              <option value="">—</option><option value="cedula">Cédula</option><option value="passport">Pasaporte</option><option value="other">Otro</option>
            </select></label>
          <label className="text-sm">Número<input name="id_number" defaultValue={customer?.id_number ?? ""} className={inputCls} /></label>
          <label className="text-sm">Licencia de conducir<input name="license_number" defaultValue={customer?.license_number ?? ""} className={inputCls} /></label>
          <DateTimePicker name="license_expires_on" mode="date" label="Vence la licencia" lang="es" defaultValue={customer?.license_expires_on ?? ""} />
        </div>
      </section>
      <section className="panel space-y-3">
        <h2>Nota de riesgo</h2>
        <label className="flex items-center gap-2"><input type="checkbox" name="risk_flag" defaultChecked={customer?.risk_flag} /> Marcar como cliente de riesgo</label>
        <label className="block">Motivo<input name="risk_note" defaultValue={customer?.risk_note ?? ""} className="input" /></label>
        <p className="text-xs text-[var(--color-muted)]">Solo para uso interno. Se mostrará una advertencia al crear una reserva para este cliente.</p>
      </section>
      <label className="block text-sm">Observaciones internas
        <textarea name="notes" rows={3} defaultValue={customer?.notes ?? ""} className={inputCls} /></label>
      <button className="btn btn-primary">{submitLabel}</button>
    </form>
  );
}
