import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import { listReservations } from "@/server/services/reservations";
import { STATUS_LABEL, type ReservationStatus } from "@/lib/reservation-rules";
import { formatBusinessDateTime } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { Badge, PageHeader, reservationTone } from "@/components/admin/ui";

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requirePermission("reservations:read");
  const { status } = await searchParams;
  const valid = status && status in STATUS_LABEL ? status : undefined;
  const rows = await listReservations(valid);
  return (
    <div>
      <PageHeader title="Reservas"
        action={ctx.permissions.has("reservations:write") ? <Link href="/admin/reservas/nueva" className="btn btn-primary">Nueva reserva</Link> : undefined} />
      <nav aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/reservas" className={`chip ${!valid ? "chip-active" : ""}`}>Todas</Link>
        {(Object.keys(STATUS_LABEL) as ReservationStatus[]).map((s) => (
          <Link key={s} href={`/admin/reservas?status=${s}`} className={`chip ${valid === s ? "chip-active" : ""}`}>{STATUS_LABEL[s]}</Link>))}
      </nav>
      {rows.length === 0 ? (
        <p className="empty">No hay reservas con este filtro.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Código</th><th>Cliente</th><th>Vehículo</th><th>Recogida</th><th>Devolución</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/reservas/${r.id}`} className="row-link">{r.code}</Link></td>
                <td>{r.customer_name}</td><td>{r.vehicle_label}</td>
                <td>{formatBusinessDateTime(r.pickup_at)}</td><td>{formatBusinessDateTime(r.return_at)}</td>
                <td>{formatMoney(toCents(r.total_amount), r.currency)}</td>
                <td><Badge tone={reservationTone(r.status)}>{STATUS_LABEL[r.status]}</Badge></td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </div>
  );
}
