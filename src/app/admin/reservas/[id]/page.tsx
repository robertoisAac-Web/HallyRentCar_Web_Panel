import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import { getReservation } from "@/server/services/reservations";
import { allowedNext, permissionForTransition, STATUS_LABEL, CHANNEL_LABEL, TRANSITION_LABEL, type ReservationStatus } from "@/lib/reservation-rules";
import { formatBusinessDateTime } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { whatsappLink } from "@/lib/whatsapp";
import { Badge, ErrorBox, OkBox, reservationTone } from "@/components/admin/ui";
import { transitionAction } from "../actions";
import { FinanceSections } from "@/components/admin/FinanceSections";
import { ChecklistSection } from "@/components/admin/ChecklistSection";

export default async function ReservationPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await requirePermission("reservations:read");
  const { id } = await params; const { error, ok } = await searchParams;
  const r = await getReservation(id);
  if (!r) notFound();
  const money = (v: string) => formatMoney(toCents(v), r.currency);
  const actions = allowedNext(r.status).filter((to) => to !== "in_progress" && to !== "completed" && ctx.permissions.has(permissionForTransition(to)));
  const first = r.customer_name.split(" ")[0];
  const when = (iso: string) => formatBusinessDateTime(iso);
  const waConfirm = whatsappLink(r.customer_phone, `Hola ${first}, te escribimos de la rent a car. Tu reserva ${r.code} (${r.vehicle_label}) está programada del ${when(r.pickup_at)} al ${when(r.return_at)}. Total: ${formatMoney(toCents(r.total_amount), r.currency)}.`);
  const waReturn = whatsappLink(r.customer_phone, `Hola ${first}, te recordamos que la devolución del vehículo (${r.vehicle_label}) está prevista para el ${when(r.return_at)}. ¡Gracias!`);
  const destructive = (to: ReservationStatus) => to === "cancelled" || to === "rejected";
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href="/admin/reservas" className="text-sm underline">← Reservas</Link>
        <h1 className="mt-2 flex items-center gap-3 page-title">{r.code} <Badge tone={reservationTone(r.status)}>{STATUS_LABEL[r.status]}</Badge></h1></div>
      <ErrorBox error={error} /><OkBox ok={ok} error={error} />
      <dl className="grid grid-cols-2 gap-4 panel text-sm">
        <div><dt className="text-slate-500">Cliente</dt><dd>{r.customer_name}</dd></div>
        <div><dt className="text-slate-500">Vehículo</dt><dd>{r.vehicle_label}</dd></div>
        <div><dt className="text-slate-500">Recogida</dt><dd>{formatBusinessDateTime(r.pickup_at)} · {r.pickup_location ?? "sin lugar"}</dd></div>
        <div><dt className="text-slate-500">Devolución</dt><dd>{formatBusinessDateTime(r.return_at)} · {r.return_location ?? "sin lugar"}</dd></div>
        <div><dt className="text-slate-500">Canal</dt><dd>{CHANNEL_LABEL[r.channel as keyof typeof CHANNEL_LABEL] ?? r.channel}</dd></div>
        <div><dt className="text-slate-500">Depósito requerido</dt><dd>{money(r.deposit_required)}</dd></div>
        <div><dt className="text-slate-500">Tarifa × días</dt><dd>{money(r.daily_rate)} × {r.billable_days}</dd></div>
        <div><dt className="text-slate-500">Descuento / extras</dt><dd>-{money(r.discount_total)} / +{money(r.extras_total)}</dd></div>
        <div className="col-span-2 border-t pt-3"><dt className="text-slate-500">Total</dt><dd className="text-lg font-semibold">{money(r.total_amount)}</dd></div>
        {r.internal_notes && <div className="col-span-2"><dt className="text-slate-500">Notas internas</dt><dd className="whitespace-pre-wrap">{r.internal_notes}</dd></div>}
        {r.customer_message && <div className="col-span-2"><dt className="text-slate-500">Mensaje del cliente</dt><dd className="whitespace-pre-wrap">{r.customer_message}</dd></div>}
      </dl>
      {(actions.length > 0) && (
        <section className="panel">
          <h2 className="mb-3 font-medium">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {actions.map((to) => destructive(to) ? (
              <details key={to}><summary className="btn btn-secondary">{TRANSITION_LABEL[to]}…</summary>
                <form action={transitionAction.bind(null, id, to)} className="mt-2">
                  <button className="btn btn-danger">Confirmar: {TRANSITION_LABEL[to]?.toLowerCase()}</button></form></details>
            ) : (
              <form key={to} action={transitionAction.bind(null, id, to)}>
                <button className="btn btn-primary">{TRANSITION_LABEL[to]}</button></form>))}
          </div>
        </section>)}
      <ChecklistSection reservationId={id} status={r.status} canWrite={ctx.permissions.has("checklists:write")} />
      {ctx.permissions.has("payments:read") && (
        <FinanceSections reservationId={id} total={r.total_amount} depositRequired={r.deposit_required} currency={r.currency}
          canWrite={ctx.permissions.has("payments:write")} canVoid={ctx.permissions.has("payments:void")} />)}
      <section>
        <h2 className="mb-2 font-medium">Historial de estados</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {r.history.map((h, i) => (<li key={i}>{formatBusinessDateTime(h.created_at)} · {h.from_status ? `${STATUS_LABEL[h.from_status as ReservationStatus]} → ` : "Creada como "}{STATUS_LABEL[h.to_status as ReservationStatus]}</li>))}
        </ul>
      </section>
    </div>
  );
}
