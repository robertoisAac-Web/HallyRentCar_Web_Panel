import type { VehicleRow } from "@/server/services/vehicles";

const input = "input";

export function VehicleForm({ action, vehicle, submitLabel }: {
  action: (formData: FormData) => void | Promise<void>;
  vehicle?: VehicleRow;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-8">
      <section className="panel space-y-4">
        <h2 className="font-medium">Datos del vehículo</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Marca *<input name="make" required defaultValue={vehicle?.make} className={input} /></label>
          <label className="text-sm">Modelo *<input name="model" required defaultValue={vehicle?.model} className={input} /></label>
          <label className="text-sm">Año *<input name="year" type="number" required defaultValue={vehicle?.year} className={input} /></label>
          <label className="text-sm">Matrícula *<input name="plate" required defaultValue={vehicle?.plate} className={input} /></label>
          <label className="text-sm">VIN / chasis<input name="vin" defaultValue={vehicle?.vin ?? ""} className={input} /></label>
          <label className="text-sm">Kilometraje<input name="mileage_km" type="number" min={0} defaultValue={vehicle?.mileage_km ?? 0} className={input} /></label>
        </div>
      </section>
      <section className="panel space-y-4">
        <h2 className="font-medium">Características</h2>
        <div className="grid grid-cols-3 gap-4">
          <label className="text-sm">Transmisión
            <select name="transmission" defaultValue={vehicle?.transmission ?? ""} className={input}>
              <option value="">—</option><option value="automatic">Automática</option><option value="manual">Manual</option>
            </select></label>
          <label className="text-sm">Combustible<input name="fuel_type" defaultValue={vehicle?.fuel_type ?? ""} className={input} /></label>
          <label className="text-sm">Asientos<input name="seats" type="number" min={1} defaultValue={vehicle?.seats ?? ""} className={input} /></label>
        </div>
        <label className="block text-sm">Equipamiento (uno por línea)
          <textarea name="features" rows={4} defaultValue={(vehicle?.features ?? []).join("\n")} className={input} /></label>
        <label className="block text-sm">Descripción
          <textarea name="description" rows={3} defaultValue={vehicle?.description ?? ""} className={input} /></label>
      </section>
      <section className="panel space-y-4">
        <h2 className="font-medium">Tarifa</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Tarifa diaria *<input name="daily_rate" required inputMode="decimal" placeholder="3500.00" defaultValue={vehicle?.daily_rate} className={input} /></label>
          <label className="text-sm">Moneda
            <select name="currency" defaultValue={vehicle?.currency ?? "DOP"} className={input}>
              <option value="DOP">DOP (RD$)</option><option value="USD">USD (US$)</option>
            </select></label>
        </div>
      </section>
      <button className="btn btn-primary">{submitLabel}</button>
    </form>
  );
}
