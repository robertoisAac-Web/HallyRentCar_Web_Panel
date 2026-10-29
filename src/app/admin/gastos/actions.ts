"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import { parseExpenseForm, parseVoidForm } from "@/lib/validators/finance";
import { createExpense, voidExpense } from "@/server/services/expenses";

export async function createExpenseAction(fd: FormData) {
  try { await createExpense(parseExpenseForm(fd), fd); }
  catch (e) { redirect(`/admin/gastos/nuevo?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/gastos");
  redirect("/admin/gastos?ok=1");
}
export async function voidExpenseAction(id: string, fd: FormData) {
  try { await voidExpense(id, parseVoidForm(fd)); }
  catch (e) { redirect(`/admin/gastos?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/gastos");
  redirect("/admin/gastos?ok=1");
}
