"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import { parsePaymentForm, parseChargeForm, parseDepositForm, parseVoidForm, parseChecklistForm } from "@/lib/validators/finance";
import { createPayment, createCharge, createDepositMovement, voidRecord, type VoidTarget } from "@/server/services/finance";
import { performHandover } from "@/server/services/handover";

async function run(id: string, fn: () => Promise<void>, back = `/admin/reservas/${id}`) {
  try { await fn(); }
  catch (e) { redirect(`${back}?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/reservas"); revalidatePath(`/admin/reservas/${id}`); revalidatePath("/admin/dashboard"); revalidatePath("/admin/calendario");
  redirect(`/admin/reservas/${id}?ok=1`);
}
export async function createPaymentAction(id: string, fd: FormData) { await run(id, () => createPayment(id, parsePaymentForm(fd))); }
export async function createChargeAction(id: string, fd: FormData) { await run(id, () => { const c = parseChargeForm(fd); return createCharge(id, c.description, c.amount); }); }
export async function createDepositAction(id: string, fd: FormData) { await run(id, () => createDepositMovement(id, parseDepositForm(fd))); }
export async function voidAction(id: string, table: VoidTarget, recordId: string, fd: FormData) { await run(id, () => voidRecord(table, recordId, parseVoidForm(fd))); }
export async function handoverAction(id: string, kind: "pickup" | "return", fd: FormData) {
  const page = kind === "pickup" ? "entrega" : "devolucion";
  await run(id, () => performHandover(id, kind, parseChecklistForm(fd), fd), `/admin/reservas/${id}/${page}`);
}
