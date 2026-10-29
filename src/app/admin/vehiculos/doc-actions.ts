"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import { addVehicleDocument, deleteVehicleDocument } from "@/server/services/vehicle-documents";

async function run(id: string, fn: () => Promise<void>) {
  try { await fn(); } catch (e) { redirect(`/admin/vehiculos/${id}?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath(`/admin/vehiculos/${id}`); revalidatePath("/admin/dashboard");
  redirect(`/admin/vehiculos/${id}?ok=1`);
}
export async function addDocAction(id: string, fd: FormData) { await run(id, () => addVehicleDocument(id, fd)); }
export async function deleteDocAction(id: string, docId: string) { await run(id, () => deleteVehicleDocument(docId)); }
