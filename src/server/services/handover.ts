import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import type { ChecklistInput } from "@/lib/validators/finance";
import { filesFrom, uploadFile, signedUrl } from "@/server/storage";
import { transitionReservation } from "./reservations";

export interface ChecklistRow {
  id: string; kind: "pickup" | "return"; odometer_km: number; fuel_level: string; condition_notes: string | null;
  damages: string | null; accessories: string | null; observations: string | null; photos: string[]; performed_at: string; performed_by: string | null;
}

function mapError(e: { code?: string; message: string }): never {
  console.error("handover service error:", e);
  throw new Error("No se pudo completar la operación");
}

export async function listChecklists(reservationId: string): Promise<(ChecklistRow & { photoUrls: string[] })[]> {
  await requirePermission("reservations:read");
  const sb = await createClient();
  const { data, error } = await sb.from("rental_checklists").select("*").eq("reservation_id", reservationId).order("performed_at");
  if (error) mapError(error);
  const rows = (data ?? []) as ChecklistRow[];
  return Promise.all(rows.map(async (r) => ({
    ...r, photoUrls: (await Promise.all(r.photos.map((p) => signedUrl("checklist-photos", p)))).filter((u): u is string => !!u),
  })));
}

/** Registra el checklist y cambia el estado: entrega => en curso, devolución => finalizada. */
export async function performHandover(reservationId: string, kind: "pickup" | "return", input: ChecklistInput, fd: FormData) {
  const ctx = await requirePermission("checklists:write");
  const sb = await createClient();
  const { data: res, error } = await sb.from("reservations").select("id,status").eq("id", reservationId).maybeSingle();
  if (error) mapError(error);
  if (!res) throw new ValidationError("Reserva no encontrada");
  const expected = kind === "pickup" ? "confirmed" : "in_progress";
  const { data: existing } = await sb.from("rental_checklists").select("id,odometer_km").eq("reservation_id", reservationId).eq("kind", kind).maybeSingle();

  if (res.status !== expected && !existing) {
    throw new ValidationError(kind === "pickup" ? "Solo se puede registrar la entrega de una reserva confirmada" : "Solo se puede registrar la devolución de un alquiler en curso");
  }
  if (kind === "return") {
    const { data: pickup } = await sb.from("rental_checklists").select("odometer_km").eq("reservation_id", reservationId).eq("kind", "pickup").maybeSingle();
    if (pickup && input.odometer_km < pickup.odometer_km) throw new ValidationError("El kilometraje de devolución no puede ser menor que el de entrega");
  }
  if (!existing) {
    const photos = await Promise.all(filesFrom(fd, "photos", 8).map((f) => uploadFile("checklist-photos", ctx.companyId, `${reservationId}`, f)));
    const { error: iErr } = await sb.from("rental_checklists").insert({
      company_id: ctx.companyId, reservation_id: reservationId, kind, odometer_km: input.odometer_km, fuel_level: input.fuel_level,
      condition_notes: input.condition_notes ?? null, damages: input.damages ?? null, accessories: input.accessories ?? null,
      observations: input.observations ?? null, photos,
    });
    if (iErr) mapError(iErr);
  }
  if (res.status === expected) await transitionReservation(reservationId, kind === "pickup" ? "in_progress" : "completed");
}
