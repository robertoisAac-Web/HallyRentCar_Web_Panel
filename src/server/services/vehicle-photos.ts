import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { filesFrom, uploadFile, removeFile, publicUrl } from "@/server/storage";

export interface PhotoRow { id: string; path: string; is_primary: boolean; url: string }

export async function listVehiclePhotos(vehicleId: string): Promise<PhotoRow[]> {
  await requirePermission("vehicles:read");
  const sb = await createClient();
  const { data } = await sb.from("vehicle_photos").select("id,path,is_primary").eq("vehicle_id", vehicleId).order("is_primary", { ascending: false }).order("created_at");
  return Promise.all((data ?? []).map(async (p) => ({ ...p, url: await publicUrl("vehicle-photos", p.path) })));
}

/** Primera foto principal de cada vehículo (para listas). */
export async function primaryPhotoUrls(vehicleIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (vehicleIds.length === 0) return out;
  const sb = await createClient();
  const { data } = await sb.from("vehicle_photos").select("vehicle_id,path,is_primary,created_at").in("vehicle_id", vehicleIds)
    .order("is_primary", { ascending: false }).order("created_at");
  for (const p of data ?? []) if (!out.has(p.vehicle_id)) out.set(p.vehicle_id, await publicUrl("vehicle-photos", p.path));
  return out;
}

export async function addVehiclePhotos(vehicleId: string, fd: FormData) {
  const ctx = await requirePermission("vehicles:write");
  const files = filesFrom(fd, "photos", 6);
  if (files.length === 0) throw new ValidationError("Selecciona al menos una foto");
  const sb = await createClient();
  const { count } = await sb.from("vehicle_photos").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId);
  if ((count ?? 0) + files.length > 12) throw new ValidationError("Máximo 12 fotos por vehículo");
  let first = (count ?? 0) === 0;
  for (const f of files) {
    const path = await uploadFile("vehicle-photos", ctx.companyId, vehicleId, f);
    const { error } = await sb.from("vehicle_photos").insert({ company_id: ctx.companyId, vehicle_id: vehicleId, path, is_primary: first });
    if (error) { console.error(error); throw new Error("No se pudo guardar la foto"); }
    first = false;
  }
}

export async function setPrimaryPhoto(vehicleId: string, photoId: string) {
  await requirePermission("vehicles:write");
  const sb = await createClient();
  await sb.from("vehicle_photos").update({ is_primary: false }).eq("vehicle_id", vehicleId);
  const { error } = await sb.from("vehicle_photos").update({ is_primary: true }).eq("id", photoId).eq("vehicle_id", vehicleId);
  if (error) { console.error(error); throw new Error("No se pudo actualizar la foto principal"); }
}

export async function deleteVehiclePhoto(vehicleId: string, photoId: string) {
  await requirePermission("vehicles:write");
  const sb = await createClient();
  const { data } = await sb.from("vehicle_photos").select("id,path,is_primary").eq("id", photoId).eq("vehicle_id", vehicleId).maybeSingle();
  if (!data) throw new ValidationError("Foto no encontrada");
  const { error } = await sb.from("vehicle_photos").delete().eq("id", photoId);
  if (error) { console.error(error); throw new Error("No se pudo eliminar la foto"); }
  await removeFile("vehicle-photos", data.path);
  if (data.is_primary) {
    const { data: next } = await sb.from("vehicle_photos").select("id").eq("vehicle_id", vehicleId).order("created_at").limit(1).maybeSingle();
    if (next) await sb.from("vehicle_photos").update({ is_primary: true }).eq("id", next.id);
  }
}
