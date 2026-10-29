"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import { addVehiclePhotos, setPrimaryPhoto, deleteVehiclePhoto } from "@/server/services/vehicle-photos";

async function run(id: string, fn: () => Promise<void>) {
  try { await fn(); } catch (e) { redirect(`/admin/vehiculos/${id}?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/vehiculos"); revalidatePath(`/admin/vehiculos/${id}`); revalidatePath("/admin/dashboard");
  redirect(`/admin/vehiculos/${id}?ok=1`);
}
export async function addPhotosAction(id: string, fd: FormData) { await run(id, () => addVehiclePhotos(id, fd)); }
export async function primaryPhotoAction(id: string, photoId: string) { await run(id, () => setPrimaryPhoto(id, photoId)); }
export async function deletePhotoAction(id: string, photoId: string) { await run(id, () => deleteVehiclePhoto(id, photoId)); }
