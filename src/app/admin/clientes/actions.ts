"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseCustomerForm } from "@/lib/validators/customer";
import { createCustomer, updateCustomer } from "@/server/services/customers";
import { errorMessage } from "@/lib/action-error";

export async function createCustomerAction(fd: FormData) {
  let id: string;
  try { id = (await createCustomer(parseCustomerForm(fd))).id; }
  catch (e) { redirect(`/admin/clientes/nuevo?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${id}?ok=1`);
}
export async function updateCustomerAction(id: string, fd: FormData) {
  try { await updateCustomer(id, parseCustomerForm(fd)); }
  catch (e) { redirect(`/admin/clientes/${id}?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${id}?ok=1`);
}
