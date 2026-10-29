import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError, blank, formValue } from "@/lib/validators/common";
import { z } from "zod";

export interface CompanyRow {
  id: string; name: string; legal_name: string | null; rnc: string | null; phone: string | null; whatsapp_number: string | null;
  tagline: string | null; address: string | null; delivery_zones: string | null; terms_text: string | null; public_enabled: boolean;
  grace_minutes: number; turnaround_minutes: number; pending_expiry_hours: number;
}
const opt = z.preprocess(blank, z.string().trim().optional());
const schema = z.object({
  name: z.string({ required_error: "El nombre comercial es obligatorio" }).trim().min(1, "El nombre comercial es obligatorio"),
  legal_name: opt, rnc: opt, phone: opt, whatsapp_number: opt, tagline: opt, address: opt, delivery_zones: opt, terms_text: opt,
  public_enabled: z.preprocess((v) => v === "on", z.boolean()),
  grace_minutes: z.coerce.number().int("Gracia inválida").min(0).max(600, "La gracia máxima es 600 minutos"),
  turnaround_minutes: z.coerce.number().int("Margen inválido").min(0).max(1440, "El margen máximo es 1440 minutos"),
  pending_expiry_hours: z.coerce.number().int("Plazo inválido").min(1).max(720, "El plazo máximo es 720 horas"),
});

export async function getCompany(): Promise<CompanyRow> {
  const ctx = await requirePermission("company:manage");
  const sb = await createClient();
  const { data, error } = await sb.from("companies").select("*").eq("id", ctx.companyId).single();
  if (error || !data) { console.error(error); throw new Error("No se pudo leer la empresa"); }
  return data as CompanyRow;
}

export async function updateCompany(fd: FormData) {
  const ctx = await requirePermission("company:manage");
  const keys = ["name", "legal_name", "rnc", "phone", "whatsapp_number", "tagline", "address", "delivery_zones", "terms_text", "public_enabled", "grace_minutes", "turnaround_minutes", "pending_expiry_hours"];
  const r = schema.safeParse(Object.fromEntries(keys.map((k) => [k, formValue(fd, k)])));
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Datos inválidos");
  const d = r.data;
  const sb = await createClient();
  const { error } = await sb.from("companies").update({
    name: d.name, legal_name: d.legal_name ?? null, rnc: d.rnc ?? null, phone: d.phone ?? null, whatsapp_number: d.whatsapp_number ?? null,
    tagline: d.tagline ?? null, address: d.address ?? null, delivery_zones: d.delivery_zones ?? null, terms_text: d.terms_text ?? null,
    public_enabled: d.public_enabled, grace_minutes: d.grace_minutes, turnaround_minutes: d.turnaround_minutes, pending_expiry_hours: d.pending_expiry_hours,
  }).eq("id", ctx.companyId);
  if (error) { console.error(error); throw new Error("No se pudo guardar la configuración"); }
}
