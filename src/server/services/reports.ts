import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { toCents } from "@/lib/money";
import { businessDayStart } from "@/lib/dates";
import { computeBalance, depositSummary } from "@/lib/finance";
import { addMoney, fleetOccupancyPercent, type MoneyMap, type Period } from "@/lib/reports";

const BILLABLE = ["confirmed", "in_progress", "completed"];

export interface Range { from: string; to: string } // YYYY-MM-DD, hora de Santo Domingo, ambos inclusivos
const bounds = (r: Range) => ({ start: businessDayStart(r.from), end: new Date(businessDayStart(r.to).getTime() + 24 * 3600_000) });

/** Cobros netos, reembolsos y gastos del período. Los registros anulados no cuentan. */
export async function getPeriodMoney(r: Range) {
  await requirePermission("reports:read");
  const { start, end } = bounds(r);
  const sb = await createClient();
  const [{ data: pay }, { data: exp }] = await Promise.all([
    sb.from("payments").select("kind,amount,currency").is("voided_at", null).gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()),
    sb.from("expenses").select("amount,currency,category,vehicle_id").is("voided_at", null).gte("expense_date", r.from).lte("expense_date", r.to),
  ]);
  const collected: MoneyMap = {}, refunds: MoneyMap = {}, expenses: MoneyMap = {};
  for (const p of pay ?? []) addMoney(p.kind === "refund" ? refunds : collected, p.currency, toCents(p.amount));
  const byCategory: Record<string, MoneyMap> = {}, byVehicleExpense: Record<string, MoneyMap> = {};
  for (const e of exp ?? []) {
    addMoney(expenses, e.currency, toCents(e.amount));
    addMoney((byCategory[e.category] ??= {}), e.currency, toCents(e.amount));
    addMoney((byVehicleExpense[e.vehicle_id ?? "general"] ??= {}), e.currency, toCents(e.amount));
  }
  return { collected, refunds, expenses, byCategory, byVehicleExpense };
}

/** Saldos pendientes y depósitos retenidos de las reservas vigentes (hasta las 400 más recientes). */
export async function getOutstanding() {
  await requirePermission("reports:read");
  const sb = await createClient();
  const { data: res } = await sb.from("reservations").select("id,code,customer_id,total_amount,currency,deposit_required,status")
    .in("status", BILLABLE).order("pickup_at", { ascending: false }).limit(400);
  const rows = res ?? [];
  if (rows.length === 0) return { balances: {} as MoneyMap, deposits: {} as MoneyMap, items: [] as { id: string; code: string; currency: string; balance: number }[] };
  const ids = rows.map((x) => x.id);
  const [{ data: pay }, { data: chg }, { data: dep }] = await Promise.all([
    sb.from("payments").select("reservation_id,kind,amount,voided_at").in("reservation_id", ids),
    sb.from("reservation_charges").select("reservation_id,amount,voided_at").in("reservation_id", ids),
    sb.from("deposit_movements").select("reservation_id,kind,amount,voided_at").in("reservation_id", ids),
  ]);
  const balances: MoneyMap = {}, deposits: MoneyMap = {};
  const items: { id: string; code: string; currency: string; balance: number }[] = [];
  for (const x of rows) {
    const b = computeBalance(toCents(x.total_amount),
      (chg ?? []).filter((c) => c.reservation_id === x.id).map((c) => ({ amountCents: toCents(c.amount), voided: !!c.voided_at })),
      (pay ?? []).filter((p) => p.reservation_id === x.id).map((p) => ({ kind: p.kind, amountCents: toCents(p.amount), voided: !!p.voided_at })));
    if (b.balance > 0) { addMoney(balances, x.currency, b.balance); items.push({ id: x.id, code: x.code, currency: x.currency, balance: b.balance }); }
    const d = depositSummary(toCents(x.deposit_required),
      (dep ?? []).filter((m) => m.reservation_id === x.id).map((m) => ({ kind: m.kind, amountCents: toCents(m.amount), voided: !!m.voided_at })));
    if (d.held > 0) addMoney(deposits, x.currency, d.held);
  }
  return { balances, deposits, items: items.sort((a, b) => b.balance - a.balance).slice(0, 15) };
}

/** Ingresos registrados (total de reservas con recogida en el período), ocupación, cancelaciones y por vehículo. */
export async function getPeriodOperations(r: Range) {
  await requirePermission("reports:read");
  const { start, end } = bounds(r);
  const sb = await createClient();
  const [{ data: inRange }, { data: overlapping }, { data: vehicles }] = await Promise.all([
    sb.from("reservations").select("vehicle_id,customer_id,total_amount,currency,status").in("status", BILLABLE)
      .gte("pickup_at", start.toISOString()).lt("pickup_at", end.toISOString()),
    sb.from("reservations").select("vehicle_id,pickup_at,return_at").in("status", ["confirmed", "in_progress", "completed"])
      .lt("pickup_at", end.toISOString()).gt("return_at", start.toISOString()),
    sb.from("vehicles").select("id,make,model,plate,is_active"),
  ]);
  const { count: cancellations } = await sb.from("reservations").select("id", { count: "exact", head: true })
    .eq("status", "cancelled").gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  const revenue: MoneyMap = {}, byVehicle: Record<string, MoneyMap> = {};
  const perCustomer = new Map<string, number>();
  for (const x of inRange ?? []) {
    addMoney(revenue, x.currency, toCents(x.total_amount));
    addMoney((byVehicle[x.vehicle_id] ??= {}), x.currency, toCents(x.total_amount));
    perCustomer.set(x.customer_id, (perCustomer.get(x.customer_id) ?? 0) + 1);
  }
  const active = (vehicles ?? []).filter((v) => v.is_active);
  const periodsByVehicle: Period[][] = active.map((v) =>
    (overlapping ?? []).filter((o) => o.vehicle_id === v.id).map((o) => ({ start: new Date(o.pickup_at), end: new Date(o.return_at) })));
  return {
    revenue, byVehicle, vehicles: (vehicles ?? []) as { id: string; make: string; model: string; plate: string }[],
    occupancy: fleetOccupancyPercent(periodsByVehicle, start, end),
    rentals: (inRange ?? []).length, cancellations: cancellations ?? 0,
    repeatCustomers: [...perCustomer.values()].filter((n) => n >= 2).length,
  };
}
