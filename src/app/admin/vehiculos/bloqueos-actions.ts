"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBlock, deleteBlock } from "@/server/services/blocks";
import { errorMessage } from "@/lib/action-error";

export async function createBlockAction(vehicleId: string, fd: FormData) {
  try { await createBlock(vehicleId, fd); }
  catch (e) { redirect(`/admin/vehiculos/${vehicleId}?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/calendario"); revalidatePath("/admin/vehiculos");
  redirect(`/admin/vehiculos/${vehicleId}?ok=1`);
}
export async function deleteBlockAction(vehicleId: string, blockId: string) {
  try { await deleteBlock(blockId); }
  catch (e) { redirect(`/admin/vehiculos/${vehicleId}?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/calendario"); revalidatePath("/admin/vehiculos");
  redirect(`/admin/vehiculos/${vehicleId}?ok=1`);
}
