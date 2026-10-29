import { listBlocks } from "@/server/services/blocks";
import { DateRangeFields } from "@/components/ui/DateRangeFields";
import { formatBusinessDateTime } from "@/lib/dates";
import { createBlockAction, deleteBlockAction } from "@/app/admin/vehiculos/bloqueos-actions";
import { inputCls } from "./ui";

export async function BlocksSection({ vehicleId, canWrite }: { vehicleId: string; canWrite: boolean }) {
  const blocks = await listBlocks(vehicleId);
  return (
    <section className="panel max-w-2xl">
      <h2 className="mb-2 font-medium">Mantenimiento y bloqueos</h2>
      <p className="mb-3 text-sm text-slate-600">Durante estos períodos el vehículo no se puede reservar.</p>
      {blocks.length === 0 ? <p className="mb-3 text-sm text-slate-500">Sin bloqueos vigentes ni futuros.</p> : (
        <ul className="mb-4 space-y-2 text-sm">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded bg-white p-2 shadow-sm">
              <span>{b.kind === "maintenance" ? "Mantenimiento" : "Bloqueo"} · {formatBusinessDateTime(b.starts_at)} → {formatBusinessDateTime(b.ends_at)}{b.reason ? ` · ${b.reason}` : ""}</span>
              {canWrite && (
                <details><summary className="cursor-pointer text-xs underline">Quitar…</summary>
                  <form action={deleteBlockAction.bind(null, vehicleId, b.id)} className="mt-1">
                    <button className="btn btn-danger btn-sm">Confirmar</button></form></details>)}
            </li>))}
        </ul>)}
      {canWrite && (
        <form action={createBlockAction.bind(null, vehicleId)} className="grid grid-cols-2 gap-3">
          <label className="text-sm">Tipo
            <select name="kind" className={inputCls}><option value="maintenance">Mantenimiento</option><option value="manual">Bloqueo manual</option></select></label>
          <label className="text-sm">Motivo<input name="reason" className={inputCls} /></label>
          <DateRangeFields startName="starts_local" endName="ends_local" startLabel="Desde" endLabel="Hasta" lang="es" />
          <div className="col-span-2"><button className="btn btn-primary">Agregar bloqueo</button></div>
        </form>)}
    </section>
  );
}
