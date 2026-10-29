import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { listVehicles } from "./vehicles";
import { businessDayStart, businessYmd } from "@/lib/dates";
import type { CalItem, CalKind } from "@/lib/calendar";

export async function getDashboard() {
  await requirePermission("reservations:read");
  const vehicles = await listVehicles();
  const sb = await createClient();
  const dayStart = businessDayStart(businessYmd(new Date()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const weekEnd = new Date(dayStart.getTime() + 7 * 24 * 3600_000);
  const iso = (d: Date) => d.toISOString();
  const [pending, pickups, returnsToday, upcoming] = await Promise.all([
    sb.from("reservations").select("id", { count: "exact", head: true }).in("status", ["pending", "in_review"]),
    sb.from("reservations").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("pickup_at", iso(dayStart)).lt("pickup_at", iso(dayEnd)),
    sb.from("reservations").select("id", { count: "exact", head: true }).eq("status", "in_progress").gte("return_at", iso(dayStart)).lt("return_at", iso(dayEnd)),
    sb.from("reservations").select("id", { count: "exact", head: true }).eq("status", "in_progress").gte("return_at", iso(dayEnd)).lt("return_at", iso(weekEnd)),
  ]);
  const counts = { total: vehicles.length, available: 0, reserved: 0, rented: 0, maintenance: 0, blocked: 0, inactive: 0 } as Record<string, number>;
  for (const v of vehicles) counts[v.status] += 1;
  return { vehicles, counts, pending: pending.count ?? 0, pickupsToday: pickups.count ?? 0, returnsToday: returnsToday.count ?? 0, upcomingReturns: upcoming.count ?? 0 };
}

export async function getCalendarData(monthStart: Date, monthEnd: Date) {
  await requirePermission("reservations:read");
  const sb = await createClient();
  const [{ data: vehicles }, { data: res }, { data: blocks }] = await Promise.all([
    sb.from("vehicles").select("id,make,model,year,plate,is_active").order("make").order("model"),
    sb.from("reservations").select("vehicle_id,status,code,pickup_at,return_at")
      .in("status", ["pending", "in_review", "confirmed", "in_progress"])
      .lt("pickup_at", monthEnd.toISOString()).gt("return_at", monthStart.toISOString()),
    sb.from("vehicle_blocks").select("vehicle_id,kind,reason,starts_at,ends_at")
      .lt("starts_at", monthEnd.toISOString()).gt("ends_at", monthStart.toISOString()),
  ]);
  const items: CalItem[] = [
    ...(res ?? []).map((r) => ({ vehicle_id: r.vehicle_id, kind: r.status as CalKind, start: new Date(r.pickup_at), end: new Date(r.return_at), label: r.code as string })),
    ...(blocks ?? []).map((b) => ({ vehicle_id: b.vehicle_id, kind: (b.kind === "maintenance" ? "maintenance" : "blocked") as CalKind, start: new Date(b.starts_at), end: new Date(b.ends_at), label: (b.reason as string | null) ?? (b.kind === "maintenance" ? "Mantenimiento" : "Bloqueo") })),
  ];
  return { vehicles: (vehicles ?? []) as { id: string; make: string; model: string; year: number; plate: string; is_active: boolean }[], items };
}
