import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/ranges";
import { businessDayStart } from "@/lib/dates";
import { toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx || !ctx.permissions.has("reports:read")) return new NextResponse("No autorizado", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  const range = resolveRange(sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const start = businessDayStart(range.from), end = new Date(businessDayStart(range.to).getTime() + 24 * 3600_000);
  const sb = await createClient();
  let csv: string;
  if (type === "payments") {
    const { data } = await sb.from("payments").select("paid_at,reservation_id,kind,method,amount,currency,reference,voided_at")
      .gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()).order("paid_at").limit(5000);
    const ids = [...new Set((data ?? []).map((p) => p.reservation_id))];
    const codes = new Map<string, string>();
    if (ids.length) { const { data: rs } = await sb.from("reservations").select("id,code").in("id", ids); for (const r of rs ?? []) codes.set(r.id, r.code); }
    csv = toCsv(["fecha", "reserva", "tipo", "metodo", "importe", "moneda", "referencia", "anulado"],
      (data ?? []).map((p) => [p.paid_at, codes.get(p.reservation_id) ?? "", p.kind, p.method, p.amount, p.currency, p.reference, p.voided_at ? "si" : "no"]));
  } else if (type === "expenses") {
    const { data } = await sb.from("expenses").select("expense_date,category,vehicle_id,vendor,description,amount,currency,voided_at")
      .gte("expense_date", range.from).lte("expense_date", range.to).order("expense_date").limit(5000);
    csv = toCsv(["fecha", "categoria", "vehiculo_id", "proveedor", "descripcion", "importe", "moneda", "anulado"],
      (data ?? []).map((e) => [e.expense_date, e.category, e.vehicle_id, e.vendor, e.description, e.amount, e.currency, e.voided_at ? "si" : "no"]));
  } else if (type === "reservations") {
    const { data } = await sb.from("reservations").select("code,status,channel,pickup_at,return_at,billable_days,total_amount,currency")
      .gte("pickup_at", start.toISOString()).lt("pickup_at", end.toISOString()).order("pickup_at").limit(5000);
    csv = toCsv(["codigo", "estado", "canal", "recogida", "devolucion", "dias", "total", "moneda"],
      (data ?? []).map((r) => [r.code, r.status, r.channel, r.pickup_at, r.return_at, r.billable_days, r.total_amount, r.currency]));
  } else return new NextResponse("Tipo de reporte inválido", { status: 400 });
  return new NextResponse("\uFEFF" + csv, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${type}-${range.from}_${range.to}.csv"`,
  } });
}
