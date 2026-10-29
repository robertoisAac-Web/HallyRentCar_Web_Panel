import Link from "next/link";
import { listChecklists } from "@/server/services/handover";
import { formatBusinessDateTime } from "@/lib/dates";
import { FUEL_LABEL } from "@/lib/validators/finance";

export async function ChecklistSection({ reservationId, status, canWrite }: { reservationId: string; status: string; canWrite: boolean }) {
  const lists = await listChecklists(reservationId);
  const pickup = lists.find((l) => l.kind === "pickup"), ret = lists.find((l) => l.kind === "return");
  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Entrega y devolución</h2>
        {canWrite && status === "confirmed" && !pickup && <Link href={`/admin/reservas/${reservationId}/entrega`} className="btn btn-primary btn-sm">Registrar entrega</Link>}
        {canWrite && status === "in_progress" && !ret && <Link href={`/admin/reservas/${reservationId}/devolucion`} className="btn btn-primary btn-sm">Registrar devolución</Link>}
      </div>
      {lists.length === 0 && <p className="text-sm text-[var(--color-muted)]">Todavía no hay entrega registrada.</p>}
      {lists.map((l) => (
        <div key={l.id} className="rounded-lg border border-[var(--color-line)] p-3 text-sm">
          <p className="font-semibold">{l.kind === "pickup" ? "Entrega" : "Devolución"} · {formatBusinessDateTime(l.performed_at)}</p>
          <p className="mt-1">{l.odometer_km.toLocaleString("es-DO")} km · combustible {FUEL_LABEL[l.fuel_level as keyof typeof FUEL_LABEL]}</p>
          {l.condition_notes && <p className="mt-1">Estado: {l.condition_notes}</p>}
          {l.damages && <p className="mt-1">Daños: {l.damages}</p>}
          {l.accessories && <p className="mt-1">Accesorios: {l.accessories}</p>}
          {l.observations && <p className="mt-1">Observaciones: {l.observations}</p>}
          {l.photoUrls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">{l.photoUrls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto ${i + 1}`} className="h-20 w-28 rounded object-cover" /></a>))}</div>)}
        </div>))}
    </section>
  );
}
