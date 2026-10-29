import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { deriveVehicleStatus, type VehicleStatus } from "@/lib/vehicle-status";
import { ValidationError, type VehicleInput } from "@/lib/validators/vehicle";

export interface VehicleRow {
  id: string; make: string; model: string; year: number; plate: string; vin: string | null;
  mileage_km: number; transmission: string | null; fuel_type: string | null; seats: number | null;
  daily_rate: string; currency: "DOP" | "USD"; features: string[]; description: string | null; is_active: boolean;
}

function toDb(i: VehicleInput) {
  return {
    make: i.make, model: i.model, year: i.year, plate: i.plate, vin: i.vin ?? null,
    mileage_km: i.mileage_km, transmission: i.transmission ?? null, fuel_type: i.fuel_type ?? null,
    seats: i.seats ?? null, daily_rate: i.daily_rate, currency: i.currency,
    description: i.description ?? null, features: i.features,
  };
}

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23505") throw new ValidationError("Ya existe un vehículo con esa matrícula");
  console.error("vehicles service error:", e);
  throw new Error("No se pudo completar la operación");
}

export async function listVehicles(): Promise<(VehicleRow & { status: VehicleStatus })[]> {
  await requirePermission("vehicles:read");
  const sb = await createClient();
  const { data: vehicles, error } = await sb.from("vehicles").select("*").order("make").order("model");
  if (error) mapError(error);
  const rows = (vehicles ?? []) as VehicleRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((v) => v.id);
  const nowIso = new Date().toISOString();
  const [{ data: reservations }, { data: blocks }] = await Promise.all([
    sb.from("reservations").select("vehicle_id,status,pickup_at,return_at")
      .in("vehicle_id", ids).in("status", ["confirmed", "in_progress"]).gte("return_at", nowIso),
    sb.from("vehicle_blocks").select("vehicle_id,kind,starts_at,ends_at").in("vehicle_id", ids).gte("ends_at", nowIso),
  ]);
  return rows.map((v) => ({ ...v, status: deriveVehicleStatus(v, reservations ?? [], blocks ?? []) }));
}

export async function getVehicle(id: string): Promise<VehicleRow | null> {
  await requirePermission("vehicles:read");
  const sb = await createClient();
  const { data, error } = await sb.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (error) mapError(error);
  return (data as VehicleRow) ?? null;
}

export async function createVehicle(input: VehicleInput): Promise<{ id: string }> {
  const ctx = await requirePermission("vehicles:write");
  const sb = await createClient();
  const { data, error } = await sb.from("vehicles").insert({ ...toDb(input), company_id: ctx.companyId }).select("id").single();
  if (error) mapError(error);
  return { id: data!.id };
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<void> {
  await requirePermission("vehicles:write");
  const sb = await createClient();
  const { data, error } = await sb.from("vehicles").update(toDb(input)).eq("id", id).select("id");
  if (error) mapError(error);
  if (!data || data.length === 0) throw new ValidationError("Vehículo no encontrado");
}

export async function setVehicleActive(id: string, active: boolean): Promise<void> {
  await requirePermission("vehicles:write");
  const sb = await createClient();
  if (!active) {
    const { count } = await sb.from("reservations").select("id", { count: "exact", head: true })
      .eq("vehicle_id", id).in("status", ["confirmed", "in_progress"]).gte("return_at", new Date().toISOString());
    if ((count ?? 0) > 0) throw new ValidationError("No se puede desactivar: tiene reservas confirmadas o en curso");
  }
  const { data, error } = await sb.from("vehicles").update({ is_active: active }).eq("id", id).select("id");
  if (error) mapError(error);
  if (!data || data.length === 0) throw new ValidationError("Vehículo no encontrado");
}
