import { FUEL_LABEL } from "@/lib/validators/finance";

export function ChecklistForm({ action, kind, lastOdometer }: { action: (fd: FormData) => void | Promise<void>; kind: "pickup" | "return"; lastOdometer?: number }) {
  return (
    <form action={action} className="max-w-2xl space-y-6">
      <section className="panel space-y-4">
        <h2>Estado del vehículo</h2>
        <div className="grid grid-cols-2 gap-4">
          <label>Kilometraje *<input name="odometer_km" type="number" min={lastOdometer ?? 0} required defaultValue={lastOdometer} className="input" /></label>
          <label>Nivel de combustible *
            <select name="fuel_level" required defaultValue="" className="input">
              <option value="" disabled>Selecciona…</option>
              {Object.entries(FUEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
        </div>
        <label className="block">Estado general<textarea name="condition_notes" rows={2} className="input" /></label>
        <label className="block">{kind === "pickup" ? "Daños preexistentes" : "Daños detectados al devolver"}<textarea name="damages" rows={2} className="input" placeholder="Si no hay, déjalo vacío" /></label>
        <label className="block">Accesorios {kind === "pickup" ? "entregados" : "devueltos"}<textarea name="accessories" rows={2} className="input" placeholder="Ej: gata, triángulos, cargador" /></label>
        <label className="block">Observaciones<textarea name="observations" rows={2} className="input" /></label>
      </section>
      <section className="panel space-y-2">
        <h2>Fotografías</h2>
        <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        <p className="text-xs text-[var(--color-muted)]">Hasta 8 fotos, 8 MB cada una. Se guardan en un almacenamiento privado.</p>
      </section>
      <button className="btn btn-primary">{kind === "pickup" ? "Registrar entrega" : "Registrar devolución"}</button>
    </form>
  );
}
