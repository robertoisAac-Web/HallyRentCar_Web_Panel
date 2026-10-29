import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/permissions";
import Link from "next/link";
import { getCustomer, listCustomerReservations } from "@/server/services/customers";
import { STATUS_LABEL, type ReservationStatus } from "@/lib/reservation-rules";
import { formatBusinessDateTime } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { whatsappLink } from "@/lib/whatsapp";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { ErrorBox, OkBox } from "@/components/admin/ui";
import { updateCustomerAction } from "../actions";

export default async function EditCustomerPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await requirePermission("customers:read");
  const { id } = await params; const { error, ok } = await searchParams;
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const history = ctx.permissions.has("reservations:read") ? await listCustomerReservations(id) : [];
  const wa = whatsappLink(customer.phone);
  return (
    <div>
      <h1 className="mb-6 page-title">{customer.full_name}</h1>
      <ErrorBox error={error} /><OkBox ok={ok} error={error} />
      {ctx.permissions.has("customers:write")
        ? <CustomerForm action={updateCustomerAction.bind(null, id)} customer={customer} submitLabel="Guardar cambios" />
        : <p className="text-sm text-slate-600">Solo lectura.</p>}
      {wa && <p className="mt-4"><a href={wa} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Abrir WhatsApp</a></p>}
      {customer.risk_flag && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Cliente marcado como de riesgo{customer.risk_note ? `: ${customer.risk_note}` : ""}.</p>}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Historial de alquileres</h2>
        {history.length === 0 ? <p className="empty">Este cliente todavía no tiene reservas.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Código</th><th>Vehículo</th><th>Recogida</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>{history.map((r) => (
              <tr key={r.id}><td><Link href={`/admin/reservas/${r.id}`} className="row-link">{r.code}</Link></td><td>{r.vehicle_label}</td>
                <td>{formatBusinessDateTime(r.pickup_at)}</td><td>{formatMoney(toCents(r.total_amount), r.currency)}</td><td>{STATUS_LABEL[r.status as ReservationStatus]}</td></tr>))}</tbody></table></div>)}
      </section>
    </div>
  );
}
