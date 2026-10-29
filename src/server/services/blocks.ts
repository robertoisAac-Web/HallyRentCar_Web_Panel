import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { parseBusinessLocal, isBusinessLocal } from "@/lib/dates";

export interface BlockRow { id: string; kind: "maintenance" | "manual"; starts_at: string; ends_at: string; reason: string | null }

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23P01") throw new ValidationError("Ese período se solapa con una reserva confirmada, un alquiler en curso u otro bloqueo");
  console.error("blocks service error:", e);
  throw new Error("No se pudo completar la operación");
}

export async function listBlocks(vehicleId: string): Promise<BlockRow[]> {
  await requirePermission("vehicles:read");
  const sb = await createClient();
  const { data, error } = await sb.from("vehicle_blocks").select("id,kind,starts_at,ends_at,reason")
    .eq("vehicle_id", vehicleId).gte("ends_at", new Date().toISOString()).order("starts_at");
  if (error) mapError(error);
  return (data ?? []) as BlockRow[];
}

export async function createBlock(vehicleId: string, fd: FormData): Promise<void> {
  const ctx = await requirePermission("availability:write");
  const kind = fd.get("kind"), s = fd.get("starts_local"), e = fd.get("ends_local"), reason = fd.get("reason");
  if (kind !== "maintenance" && kind !== "manual") throw new ValidationError("Tipo de bloqueo inválido");
  if (typeof s !== "string" || typeof e !== "string" || !isBusinessLocal(s) || !isBusinessLocal(e))
    throw new ValidationError("Fechas inválidas");
  const start = parseBusinessLocal(s), end = parseBusinessLocal(e);
  if (!(end.getTime() > start.getTime())) throw new ValidationError("El fin debe ser posterior al inicio");
  const sb = await createClient();
  const { error } = await sb.from("vehicle_blocks").insert({
    company_id: ctx.companyId, vehicle_id: vehicleId, kind, starts_at: start.toISOString(), ends_at: end.toISOString(),
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : null, created_by: ctx.userId,
  });
  if (error) mapError(error);
}

export async function deleteBlock(blockId: string): Promise<void> {
  await requirePermission("availability:write");
  const sb = await createClient();
  const { error } = await sb.from("vehicle_blocks").delete().eq("id", blockId);
  if (error) mapError(error);
}
