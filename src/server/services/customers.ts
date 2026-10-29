import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import type { CustomerInput } from "@/lib/validators/customer";

export interface CustomerRow {
  id: string; full_name: string; phone: string | null; email: string | null; country: string | null;
  id_type: "cedula" | "passport" | "other" | null; id_number: string | null;
  license_number: string | null; license_expires_on: string | null; notes: string | null;
  risk_flag: boolean; risk_note: string | null;
}

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23505") throw new ValidationError("Ya existe un cliente con ese documento de identidad");
  console.error("customers service error:", e);
  throw new Error("No se pudo completar la operación");
}
const toDb = (i: CustomerInput) => ({
  full_name: i.full_name, phone: i.phone ?? null, email: i.email ?? null, country: i.country ?? null,
  id_type: i.id_type ?? null, id_number: i.id_number ?? null, license_number: i.license_number ?? null,
  license_expires_on: i.license_expires_on ?? null, notes: i.notes ?? null,
  risk_flag: i.risk_flag, risk_note: i.risk_note ?? null,
});

export async function listCustomers(search?: string): Promise<CustomerRow[]> {
  await requirePermission("customers:read");
  const sb = await createClient();
  let q = sb.from("customers").select("*").order("full_name");
  const term = (search ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,id_number.ilike.%${term}%`);
  const { data, error } = await q.limit(200);
  if (error) mapError(error);
  return (data ?? []) as CustomerRow[];
}
export async function getCustomer(id: string): Promise<CustomerRow | null> {
  await requirePermission("customers:read");
  const sb = await createClient();
  const { data, error } = await sb.from("customers").select("*").eq("id", id).maybeSingle();
  if (error) mapError(error);
  return (data as CustomerRow) ?? null;
}
export async function createCustomer(input: CustomerInput): Promise<{ id: string }> {
  const ctx = await requirePermission("customers:write");
  const sb = await createClient();
  const { data, error } = await sb.from("customers").insert({ ...toDb(input), company_id: ctx.companyId }).select("id").single();
  if (error) mapError(error);
  return { id: data!.id };
}
export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  await requirePermission("customers:write");
  const sb = await createClient();
  const { data, error } = await sb.from("customers").update(toDb(input)).eq("id", id).select("id");
  if (error) mapError(error);
  if (!data || data.length === 0) throw new ValidationError("Cliente no encontrado");
}

export async function listCustomerReservations(customerId: string) {
  await requirePermission("reservations:read");
  const sb = await createClient();
  const { data, error } = await sb.from("reservations").select("id,code,status,pickup_at,return_at,total_amount,currency,vehicle_id")
    .eq("customer_id", customerId).order("pickup_at", { ascending: false }).limit(50);
  if (error) mapError(error);
  const ids = [...new Set((data ?? []).map((r) => r.vehicle_id))];
  const vm = new Map<string, string>();
  if (ids.length) { const { data: vs } = await sb.from("vehicles").select("id,make,model,plate").in("id", ids); for (const v of vs ?? []) vm.set(v.id, `${v.make} ${v.model} (${v.plate})`); }
  return (data ?? []).map((r) => ({ ...r, vehicle_label: vm.get(r.vehicle_id) ?? "—" }));
}
