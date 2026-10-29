import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import type { ExpenseInput } from "@/lib/validators/finance";
import { filesFrom, uploadFile } from "@/server/storage";

export interface ExpenseRow { id: string; vehicle_id: string | null; category: string; amount: string; currency: "DOP" | "USD"; expense_date: string; vendor: string | null; description: string | null; receipt_path: string | null; voided_at: string | null; void_reason: string | null }

function mapError(e: { code?: string; message: string }): never {
  console.error("expenses service error:", e);
  throw new Error("No se pudo completar la operación");
}

export async function listExpenses(fromYmd: string, toYmd: string): Promise<(ExpenseRow & { vehicle_label: string })[]> {
  await requirePermission("expenses:read");
  const sb = await createClient();
  const { data, error } = await sb.from("expenses").select("*").gte("expense_date", fromYmd).lte("expense_date", toYmd)
    .order("expense_date", { ascending: false }).limit(500);
  if (error) mapError(error);
  const rows = (data ?? []) as ExpenseRow[];
  const ids = [...new Set(rows.map((r) => r.vehicle_id).filter((x): x is string => !!x))];
  const vm = new Map<string, string>();
  if (ids.length) {
    const { data: vs } = await sb.from("vehicles").select("id,make,model,plate").in("id", ids);
    for (const v of vs ?? []) vm.set(v.id, `${v.make} ${v.model} (${v.plate})`);
  }
  return rows.map((r) => ({ ...r, vehicle_label: r.vehicle_id ? vm.get(r.vehicle_id) ?? "—" : "General" }));
}

export async function createExpense(input: ExpenseInput, fd: FormData) {
  const ctx = await requirePermission("expenses:write");
  const files = filesFrom(fd, "receipt", 1);
  const receipt_path = files[0] ? await uploadFile("expense-receipts", ctx.companyId, "receipts", files[0], true) : null;
  const sb = await createClient();
  const { error } = await sb.from("expenses").insert({
    company_id: ctx.companyId, vehicle_id: input.vehicle_id ?? null, category: input.category, amount: input.amount,
    currency: input.currency, expense_date: input.expense_date, vendor: input.vendor ?? null,
    description: input.description ?? null, receipt_path,
  });
  if (error) mapError(error);
}

export async function voidExpense(id: string, reason: string) {
  const ctx = await requirePermission("expenses:write");
  const sb = await createClient();
  const { data, error } = await sb.from("expenses").update({ voided_at: new Date().toISOString(), voided_by: ctx.userId, void_reason: reason })
    .eq("id", id).is("voided_at", null).select("id");
  if (error) mapError(error);
  if (!data || data.length === 0) throw new ValidationError("El gasto no existe o ya estaba anulado");
}
