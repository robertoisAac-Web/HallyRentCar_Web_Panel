import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ValidationError } from "@/lib/validators/common";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export function filesFrom(fd: FormData, field: string, max: number): File[] {
  const files = fd.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > max) throw new ValidationError(`Máximo ${max} archivos`);
  return files;
}

/** Sube un archivo a <company>/<folder>/<uuid>.<ext>. Solo imágenes o PDF, máx. 8 MB. Devuelve la ruta. */
export async function uploadFile(bucket: string, companyId: string, folder: string, file: File, allowPdf = false): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext || (ext === "pdf" && !allowPdf)) throw new ValidationError("Formato no permitido (usa JPG, PNG o WEBP" + (allowPdf ? " o PDF" : "") + ")");
  if (file.size > MAX_BYTES) throw new ValidationError("El archivo supera los 8 MB");
  const path = `${companyId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const sb = await createClient();
  const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) { console.error("storage upload error:", error); throw new Error("No se pudo subir el archivo"); }
  return path;
}

/** URL temporal (5 min) para archivos privados. */
export async function signedUrl(bucket: string, path: string, seconds = 300): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
export async function publicUrl(bucket: string, path: string): Promise<string> {
  const sb = await createClient();
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
export async function removeFile(bucket: string, path: string) {
  const sb = await createClient();
  await sb.storage.from(bucket).remove([path]);
}
