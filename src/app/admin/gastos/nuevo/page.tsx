import { requirePermission } from "@/server/auth/permissions";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { listVehicles } from "@/server/services/vehicles";
import { businessYmd } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/validators/finance";
import { ErrorBox, PageHeader } from "@/components/admin/ui";
import { createExpenseAction } from "../actions";

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await requirePermission("expenses:write");
  const { error } = await searchParams;
  const vehicles = ctx.permissions.has("vehicles:read") ? await listVehicles() : [];
  return (
    <div>
      <PageHeader title="Nuevo gasto" />
      <ErrorBox error={error} />
      <form action={createExpenseAction} className="max-w-2xl space-y-6">
        <section className="panel space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label>Categoría *<select name="category" required className="input">{Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label>Vehículo<select name="vehicle_id" className="input"><option value="">General (toda la empresa)</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plate})</option>)}</select></label>
            <label>Importe *<input name="amount" required inputMode="decimal" className="input" /></label>
            <label>Moneda<select name="currency" className="input"><option value="DOP">DOP (RD$)</option><option value="USD">USD (US$)</option></select></label>
            <DateTimePicker name="expense_date" mode="date" label="Fecha" required lang="es" defaultValue={businessYmd(new Date())} />
            <label>Proveedor<input name="vendor" className="input" /></label>
          </div>
          <label className="block">Descripción<textarea name="description" rows={2} className="input" /></label>
          <label className="block">Comprobante (JPG, PNG, WEBP o PDF, máx. 8 MB)<input name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block" /></label>
        </section>
        <button className="btn btn-primary">Guardar gasto</button>
      </form>
    </div>
  );
}
