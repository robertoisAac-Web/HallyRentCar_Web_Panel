import { periodsOverlap } from "./availability.ts";

export type CalKind = "in_progress" | "confirmed" | "maintenance" | "blocked" | "in_review" | "pending";
export interface CalItem { vehicle_id: string; kind: CalKind; start: Date; end: Date; label: string }

/** Prioridad visual cuando varios elementos caen el mismo día. */
const PRIORITY: CalKind[] = ["in_progress", "confirmed", "maintenance", "blocked", "in_review", "pending"];

export function daysOfMonth(ym: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) throw new Error("Mes inválido");
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error("Mes inválido");
  const n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function itemsForDay(items: CalItem[], vehicleId: string, dayStart: Date): CalItem[] {
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  return items
    .filter((i) => i.vehicle_id === vehicleId && periodsOverlap(i.start, i.end, dayStart, dayEnd))
    .sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
}
