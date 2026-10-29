import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import { listVehicles } from "@/server/services/vehicles";
import { primaryPhotoUrls } from "@/server/services/vehicle-photos";
import { STATUS_LABEL } from "@/lib/vehicle-status";
import { formatMoney, toCents } from "@/lib/money";
import { Badge, PageHeader, Plate, vehicleTone } from "@/components/admin/ui";

export default async function VehiclesPage() {
  const ctx = await requirePermission("vehicles:read");
  const vehicles = await listVehicles();
  const photos = await primaryPhotoUrls(vehicles.map((v) => v.id));
  return (
    <div>
      <PageHeader title="Vehículos" subtitle={`${vehicles.length} registrados`}
        action={ctx.permissions.has("vehicles:write") ? <Link href="/admin/vehiculos/nuevo" className="btn btn-primary">Nuevo vehículo</Link> : undefined} />
      {vehicles.length === 0 ? (
        <p className="empty">Todavía no hay vehículos. Registra el primero con “Nuevo vehículo”.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Vehículo</th><th>Matrícula</th><th>Tarifa diaria</th><th>Estado</th></tr></thead>
            <tbody>{vehicles.map((v) => (
              <tr key={v.id}>
                <td><div className="flex items-center gap-3">{photos.get(v.id) ? <img src={photos.get(v.id)} alt="" className="h-10 w-16 rounded object-cover" /> : <div className="h-10 w-16 rounded bg-[var(--color-canvas)]" />}<span><Link href={`/admin/vehiculos/${v.id}`} className="row-link">{v.make} {v.model}</Link> <span className="text-[var(--color-muted)]">{v.year}</span></span></div></td>
                <td><Plate>{v.plate}</Plate></td>
                <td>{formatMoney(toCents(v.daily_rate), v.currency)}</td>
                <td><Badge tone={vehicleTone(v.status)}>{STATUS_LABEL[v.status]}</Badge></td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </div>
  );
}
