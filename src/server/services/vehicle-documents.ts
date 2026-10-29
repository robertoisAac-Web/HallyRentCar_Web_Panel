import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { filesFrom, uploadFile, signedUrl } from "@/server/storage";

export interface VehicleDocRow { id: string; doc_type: string; number: string | null; expires_on: string | null; file_path: string | null; notes: string | null; url: string | null }

export async function listVehicleDocuments(vehicleId: string): Promise<VehicleDocRow[]> {
  await requirePermission("vehicles:read");
  const sb = await createClient();
  const { data } = await sb.from("vehicle_documents").select("id,doc_type,number,expires_on,file_path,notes").eq("vehicle_id", vehicleId).order("expires_on", { nullsFirst: false });
  return Promise.all((data ?? []).map(async (d) => ({ ...d, url: d.file_path ? await signedUrl("vehicle-documents", d.file_path) : null })));
}

export async function addVehicleDocument(vehicleId: string, fd: FormData) {
  const ctx = await requirePermission("vehicles:write");
  const type = String(fd.get("doc_type") ?? ""), expires = String(fd.get("expires_on") ?? ""), number = String(fd.get("number") ?? "").trim();
  if (!["insurance", "registration", "inspection", "other"].includes(type)) throw new ValidationError("Tipo de documento inválido");
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new ValidationError("Fecha de vencimiento inválida");
  const files = filesFrom(fd, "file", 1);
  const file_path = files[0] ? await uploadFile("vehicle-documents", ctx.companyId, vehicleId, files[0], true) : null;
  const sb = await createClient();
  const { error } = await sb.from("vehicle_documents").insert({ company_id: ctx.companyId, vehicle_id: vehicleId, doc_type: type, number: number || null, expires_on: expires || null, file_path, notes: String(fd.get("notes") ?? "").trim() || null });
  if (error) { console.error(error); throw new Error("No se pudo guardar el documento"); }
}

export async function deleteVehicleDocument(id: string) {
  await requirePermission("vehicles:write");
  const sb = await createClient();
  const { error } = await sb.from("vehicle_documents").delete().eq("id", id);
  if (error) { console.error(error); throw new Error("No se pudo eliminar el documento"); }
}
