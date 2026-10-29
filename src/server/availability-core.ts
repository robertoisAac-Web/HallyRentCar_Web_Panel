import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isVehicleFree, type Busy } from "@/lib/availability";

export interface VehicleLite { id: string; make: string; model: string; year: number; plate: string; daily_rate: string; currency: "DOP" | "USD"; is_active: boolean }

/** Única implementación de "¿qué vehículos están libres?". La usan el panel (cliente con RLS) y la web pública (servidor). */
export async function computeFreeVehicles(sb: SupabaseClient, companyId: string, pickup: Date, ret: Date, turnaroundMinutes: number): Promise<VehicleLite[]> {
  const { data: vehicles, error } = await sb.from("vehicles")
    .select("id,make,model,year,plate,daily_rate,currency,is_active").eq("company_id", companyId).eq("is_active", true).order("make").order("model");
  if (error) { console.error("availability vehicles error:", error); throw new Error("No se pudo consultar la disponibilidad"); }
  const list = (vehicles ?? []) as VehicleLite[];
  if (list.length === 0) return [];
  const endB = new Date(ret.getTime() + turnaroundMinutes * 60_000);
  const pad = new Date(pickup.getTime() - 7 * 24 * 3600_000);
  const [{ data: res }, { data: blocks }] = await Promise.all([
    sb.from("reservations").select("vehicle_id,pickup_at,return_at,buffer_minutes").eq("company_id", companyId)
      .in("status", ["confirmed", "in_progress"]).lt("pickup_at", endB.toISOString()).gte("return_at", pad.toISOString()),
    sb.from("vehicle_blocks").select("vehicle_id,starts_at,ends_at").eq("company_id", companyId)
      .lt("starts_at", endB.toISOString()).gt("ends_at", pickup.toISOString()),
  ]);
  const busyBy = new Map<string, Busy[]>();
  const add = (id: string, b: Busy) => busyBy.set(id, [...(busyBy.get(id) ?? []), b]);
  for (const r of res ?? []) add(r.vehicle_id, { start: new Date(r.pickup_at), end: new Date(new Date(r.return_at).getTime() + r.buffer_minutes * 60_000) });
  for (const b of blocks ?? []) add(b.vehicle_id, { start: new Date(b.starts_at), end: new Date(b.ends_at) });
  return list.filter((v) => isVehicleFree(pickup, ret, turnaroundMinutes, busyBy.get(v.id) ?? []));
}
