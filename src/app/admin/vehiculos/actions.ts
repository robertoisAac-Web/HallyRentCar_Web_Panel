"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseVehicleForm, ValidationError } from "@/lib/validators/vehicle";
import { createVehicle, updateVehicle, setVehicleActive } from "@/server/services/vehicles";

function message(e: unknown): string {
  if (e instanceof ValidationError) return e.message;
  console.error(e);
  return "Ocurrió un error inesperado";
}

export async function createVehicleAction(formData: FormData) {
  let id: string;
  try { id = (await createVehicle(parseVehicleForm(formData))).id; }
  catch (e) { redirect(`/admin/vehiculos/nuevo?error=${encodeURIComponent(message(e))}`); }
  revalidatePath("/admin/vehiculos");
  redirect(`/admin/vehiculos/${id}?ok=1`);
}

export async function updateVehicleAction(id: string, formData: FormData) {
  try { await updateVehicle(id, parseVehicleForm(formData)); }
  catch (e) { redirect(`/admin/vehiculos/${id}?error=${encodeURIComponent(message(e))}`); }
  revalidatePath("/admin/vehiculos");
  redirect(`/admin/vehiculos/${id}?ok=1`);
}

export async function setVehicleActiveAction(id: string, active: boolean) {
  try { await setVehicleActive(id, active); }
  catch (e) { redirect(`/admin/vehiculos/${id}?error=${encodeURIComponent(message(e))}`); }
  revalidatePath("/admin/vehiculos");
  redirect(`/admin/vehiculos/${id}?ok=1`);
}
