import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { businessYmd } from "@/lib/dates";
import { daysUntil, licenseProblem } from "@/lib/alerts";

export interface Alert { key: string; tone: "red" | "amber"; text: string; href: string }

export async function getAlerts(perms: Set<string>): Promise<Alert[]> {
  await requirePermission("reservations:read");
  const sb = await createClient();
  const now = new Date(), today = businessYmd(now), alerts: Alert[] = [];
  await sb.rpc("expire_pending_reservations"); // vence solicitudes pendientes cuyo plazo pasó

  const { data: overdue } = await sb.from("reservations").select("id,code,return_at").eq("status", "in_progress").lt("return_at", now.toISOString()).order("return_at").limit(10);
  for (const r of overdue ?? []) alerts.push({ key: `o${r.id}`, tone: "red", href: `/admin/reservas/${r.id}`, text: `Devolución atrasada: ${r.code}` });

  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const { data: stale } = await sb.from("reservations").select("id,code").eq("status", "pending").lt("created_at", dayAgo).limit(10);
  for (const r of stale ?? []) alerts.push({ key: `s${r.id}`, tone: "amber", href: `/admin/reservas/${r.id}`, text: `Solicitud sin responder hace más de 24 h: ${r.code}` });

  if (perms.has("customers:read")) {
    const { data: act } = await sb.from("reservations").select("id,code,customer_id,return_at").in("status", ["confirmed", "in_progress"]).limit(100);
    const ids = [...new Set((act ?? []).map((r) => r.customer_id))];
    if (ids.length) {
      const { data: cs } = await sb.from("customers").select("id,full_name,license_expires_on").in("id", ids);
      const cm = new Map((cs ?? []).map((c) => [c.id, c]));
      for (const r of act ?? []) {
        const c = cm.get(r.customer_id);
        const prob = c ? licenseProblem(c.license_expires_on, businessYmd(new Date(r.return_at))) : null;
        if (c && prob) alerts.push({ key: `l${r.id}`, tone: "amber", href: `/admin/reservas/${r.id}`, text: `Licencia de ${c.full_name} ${prob === "expired" ? "vence antes de la devolución" : "vence el día de la devolución"} (${r.code})` });
      }
    }
  }
  if (perms.has("vehicles:read")) {
    const limit = new Date(now.getTime() + 30 * 86_400_000);
    const { data: docs } = await sb.from("vehicle_documents").select("id,vehicle_id,doc_type,expires_on").not("expires_on", "is", null).lte("expires_on", businessYmd(limit)).order("expires_on").limit(15);
    const vids = [...new Set((docs ?? []).map((d) => d.vehicle_id))];
    const vm = new Map<string, string>();
    if (vids.length) { const { data: vs } = await sb.from("vehicles").select("id,make,model,plate").in("id", vids); for (const v of vs ?? []) vm.set(v.id, `${v.make} ${v.model} (${v.plate})`); }
    const label: Record<string, string> = { insurance: "Seguro", registration: "Matrícula", inspection: "Inspección", other: "Documento" };
    for (const d of docs ?? []) {
      const n = daysUntil(d.expires_on, today);
      alerts.push({ key: `d${d.id}`, tone: n < 0 ? "red" : "amber", href: `/admin/vehiculos/${d.vehicle_id}`,
        text: `${label[d.doc_type] ?? "Documento"} de ${vm.get(d.vehicle_id) ?? "vehículo"} ${n < 0 ? `venció hace ${-n} día(s)` : n === 0 ? "vence hoy" : `vence en ${n} día(s)`}` });
    }
  }
  return alerts;
}
