import { listVehicleDocuments } from "@/server/services/vehicle-documents";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { DOC_TYPE_LABEL, daysUntil } from "@/lib/alerts";
import { businessYmd } from "@/lib/dates";
import { addDocAction, deleteDocAction } from "@/app/admin/vehiculos/doc-actions";
import { Badge } from "./ui";

export async function DocumentsSection({ vehicleId, canWrite }: { vehicleId: string; canWrite: boolean }) {
  const docs = await listVehicleDocuments(vehicleId);
  const today = businessYmd(new Date());
  return (
    <section className="panel max-w-2xl space-y-3">
      <h2>Seguro y documentos</h2>
      {docs.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Sin documentos registrados.</p> : (
        <ul className="space-y-2 text-sm">{docs.map((d) => {
          const n = d.expires_on ? daysUntil(d.expires_on, today) : null;
          return (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] p-2">
              <span>{DOC_TYPE_LABEL[d.doc_type]}{d.number ? ` · ${d.number}` : ""}{d.expires_on ? ` · vence ${d.expires_on}` : ""}
                {n !== null && (n < 0 ? <> <Badge tone="red">Vencido</Badge></> : n <= 30 ? <> <Badge tone="amber">Vence en {n} d</Badge></> : null)}
                {d.url && <> · <a href={d.url} target="_blank" rel="noreferrer" className="underline">Ver archivo</a></>}</span>
              {canWrite && (<details><summary className="cursor-pointer text-xs underline">Eliminar…</summary>
                <form action={deleteDocAction.bind(null, vehicleId, d.id)} className="mt-1"><button className="btn btn-danger btn-sm">Confirmar</button></form></details>)}
            </li>);
        })}</ul>)}
      {canWrite && (
        <form action={addDocAction.bind(null, vehicleId)} className="grid grid-cols-2 gap-3">
          <label>Tipo<select name="doc_type" className="input">{Object.entries(DOC_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Número / póliza<input name="number" className="input" /></label>
          <DateTimePicker name="expires_on" mode="date" label="Vence" lang="es" />
          <label>Archivo (opcional)<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block" /></label>
          <div className="col-span-2"><button className="btn btn-secondary">Agregar documento</button></div>
        </form>)}
    </section>
  );
}
