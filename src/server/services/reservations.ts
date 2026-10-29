import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireAuth } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import type { ReservationInput } from "@/lib/validators/reservation";
import { billableDays, quoteTotalCents } from "@/lib/pricing";
import { fromCents, toCents } from "@/lib/money";
import { parseBusinessLocal } from "@/lib/dates";
import { computeFreeVehicles, type VehicleLite } from "@/server/availability-core";
import { canTransition, permissionForTransition, type ReservationStatus } from "@/lib/reservation-rules";

export interface CompanySettings { grace_minutes: number; turnaround_minutes: number; pending_expiry_hours: number }
export interface ReservationRow {
  id: string; code: string; customer_id: string; vehicle_id: string; status: ReservationStatus; channel: string;
  pickup_at: string; return_at: string; pickup_location: string | null; return_location: string | null;
  daily_rate: string; billable_days: number; discount_total: string; extras_total: string; total_amount: string;
  currency: "DOP" | "USD"; deposit_required: string; internal_notes: string | null; customer_message: string | null;
  expires_at: string | null; created_at: string;
}
export type { VehicleLite };

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23P01") throw new ValidationError("El vehículo ya está reservado o bloqueado en ese período");
  if (e.code === "23514") throw new ValidationError("Operación no permitida para el estado actual de la reserva");
  console.error("reservations service error:", e);
  throw new Error("No se pudo completar la operación");
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const ctx = await requireAuth();
  const sb = await createClient();
  const { data, error } = await sb.from("companies").select("grace_minutes,turnaround_minutes,pending_expiry_hours")
    .eq("id", ctx.companyId).single();
  if (error || !data) { console.error(error); throw new Error("No se pudo leer la configuración de la empresa"); }
  return data as CompanySettings;
}

/** Vehículos activos libres en el período. La base de datos vuelve a imponerlo al confirmar. */
export async function findAvailableVehicles(pickup: Date, ret: Date): Promise<VehicleLite[]> {
  const ctx = await requirePermission("reservations:read");
  const settings = await getCompanySettings();
  const sb = await createClient();
  return computeFreeVehicles(sb, ctx.companyId, pickup, ret, settings.turnaround_minutes);
}

export async function createReservation(input: ReservationInput): Promise<{ id: string }> {
  const ctx = await requirePermission("reservations:write");
  if (input.initial_status === "confirmed" && !ctx.permissions.has("reservations:confirm"))
    throw new ValidationError("No tienes permiso para crear reservas ya confirmadas");
  const pickup = parseBusinessLocal(input.pickup_local);
  const ret = parseBusinessLocal(input.return_local);
  if (!(ret.getTime() > pickup.getTime())) throw new ValidationError("La devolución debe ser posterior a la recogida");

  const settings = await getCompanySettings();
  const sb = await createClient();
  const { data: vehicle, error: vErr } = await sb.from("vehicles").select("id,daily_rate,currency,is_active").eq("id", input.vehicle_id).maybeSingle();
  if (vErr) mapError(vErr);
  if (!vehicle) throw new ValidationError("Vehículo no encontrado");
  if (!vehicle.is_active) throw new ValidationError("El vehículo está inactivo");

  const free = (await findAvailableVehicles(pickup, ret)).some((v) => v.id === vehicle.id);
  if (!free) throw new ValidationError("El vehículo no está disponible en esas fechas");

  const days = billableDays(pickup, ret, settings.grace_minutes);
  let total: number;
  try {
    total = quoteTotalCents({ dailyRateCents: toCents(vehicle.daily_rate), days,
      discountCents: toCents(input.discount), extrasCents: toCents(input.extras) });
  } catch (e) { throw new ValidationError(e instanceof Error ? e.message : "Importes inválidos"); }

  const pending = input.initial_status === "pending";
  const { data, error } = await sb.from("reservations").insert({
    company_id: ctx.companyId, customer_id: input.customer_id, vehicle_id: input.vehicle_id,
    status: input.initial_status, channel: input.channel,
    pickup_at: pickup.toISOString(), return_at: ret.toISOString(), buffer_minutes: settings.turnaround_minutes,
    pickup_location: input.pickup_location ?? null, return_location: input.return_location ?? null,
    daily_rate: vehicle.daily_rate, billable_days: days,
    discount_total: fromCents(toCents(input.discount)), extras_total: fromCents(toCents(input.extras)),
    total_amount: fromCents(total), currency: vehicle.currency, deposit_required: fromCents(toCents(input.deposit_required)),
    expires_at: pending ? new Date(Date.now() + settings.pending_expiry_hours * 3600_000).toISOString() : null,
    internal_notes: input.internal_notes ?? null, created_by: ctx.userId,
  }).select("id").single();
  if (error) mapError(error);
  return { id: data!.id };
}

export async function transitionReservation(id: string, to: ReservationStatus): Promise<void> {
  const ctx = await requirePermission(permissionForTransition(to));
  void ctx;
  const sb = await createClient();
  const { data: current, error } = await sb.from("reservations").select("id,status").eq("id", id).maybeSingle();
  if (error) mapError(error);
  if (!current) throw new ValidationError("Reserva no encontrada");
  const from = current.status as ReservationStatus;
  if (!canTransition(from, to)) throw new ValidationError("Ese cambio de estado no está permitido");
  const { data: updated, error: uErr } = await sb.from("reservations").update({ status: to })
    .eq("id", id).eq("status", from).select("id");
  if (uErr) mapError(uErr);
  if (!updated || updated.length === 0) throw new ValidationError("La reserva cambió mientras la editabas; recarga la página");
}

export async function listReservations(status?: string): Promise<(ReservationRow & { customer_name: string; vehicle_label: string })[]> {
  await requirePermission("reservations:read");
  const sb = await createClient();
  let q = sb.from("reservations").select("*").order("pickup_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) mapError(error);
  return attachNames((data ?? []) as ReservationRow[]);
}

async function attachNames(rows: ReservationRow[]) {
  if (rows.length === 0) return [];
  const sb = await createClient();
  const cIds = [...new Set(rows.map((r) => r.customer_id))];
  const vIds = [...new Set(rows.map((r) => r.vehicle_id))];
  const [{ data: cs }, { data: vs }] = await Promise.all([
    sb.from("customers").select("id,full_name,phone").in("id", cIds),
    sb.from("vehicles").select("id,make,model,year,plate").in("id", vIds),
  ]);
  const cm = new Map((cs ?? []).map((c) => [c.id, c.full_name as string]));
  const cp = new Map((cs ?? []).map((c) => [c.id, (c.phone as string | null) ?? null]));
  const vm = new Map((vs ?? []).map((v) => [v.id, `${v.make} ${v.model} ${v.year} (${v.plate})`]));
  return rows.map((r) => ({ ...r, customer_name: cm.get(r.customer_id) ?? "(sin acceso)", customer_phone: cp.get(r.customer_id) ?? null, vehicle_label: vm.get(r.vehicle_id) ?? "(desconocido)" }));
}

export async function getReservation(id: string) {
  await requirePermission("reservations:read");
  const sb = await createClient();
  const { data, error } = await sb.from("reservations").select("*").eq("id", id).maybeSingle();
  if (error) mapError(error);
  if (!data) return null;
  const [row] = await attachNames([data as ReservationRow]);
  const { data: history } = await sb.from("reservation_status_history")
    .select("from_status,to_status,created_at").eq("reservation_id", id).order("created_at");
  return { ...row, history: (history ?? []) as { from_status: string | null; to_status: string; created_at: string }[] };
}
