import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { toCents } from "@/lib/money";
import { computeBalance, depositSummary } from "@/lib/finance";
import type { PaymentInput, DepositInput } from "@/lib/validators/finance";

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23514" || e.code === "P0001") {
    throw new ValidationError(e.message.replace(/^.*?:\s*/, "") || "Operación no permitida");
  }
  if (e.code === "42501") throw new ValidationError("No tienes permiso para esta operación");
  console.error("finance service error:", e);
  throw new Error("No se pudo completar la operación");
}

export interface PaymentRow { id: string; kind: "advance" | "payment" | "refund"; method: string; amount: string; currency: string; reference: string | null; note: string | null; paid_at: string; voided_at: string | null; void_reason: string | null }
export interface ChargeRow { id: string; description: string; amount: string; currency: string; created_at: string; voided_at: string | null; void_reason: string | null }
export interface DepositRow { id: string; kind: "received" | "returned" | "applied"; method: string | null; amount: string; currency: string; reference: string | null; note: string | null; occurred_at: string; voided_at: string | null; void_reason: string | null }

export async function getReservationFinance(reservationId: string, totalAmount: string, depositRequired: string) {
  await requirePermission("payments:read");
  const sb = await createClient();
  const [p, c, d] = await Promise.all([
    sb.from("payments").select("id,kind,method,amount,currency,reference,note,paid_at,voided_at,void_reason").eq("reservation_id", reservationId).order("paid_at"),
    sb.from("reservation_charges").select("id,description,amount,currency,created_at,voided_at,void_reason").eq("reservation_id", reservationId).order("created_at"),
    sb.from("deposit_movements").select("id,kind,method,amount,currency,reference,note,occurred_at,voided_at,void_reason").eq("reservation_id", reservationId).order("occurred_at"),
  ]);
  for (const r of [p, c, d]) if (r.error) mapError(r.error);
  const payments = (p.data ?? []) as PaymentRow[], charges = (c.data ?? []) as ChargeRow[], deposits = (d.data ?? []) as DepositRow[];
  const balance = computeBalance(toCents(totalAmount),
    charges.map((x) => ({ amountCents: toCents(x.amount), voided: !!x.voided_at })),
    payments.map((x) => ({ kind: x.kind, amountCents: toCents(x.amount), voided: !!x.voided_at })));
  const deposit = depositSummary(toCents(depositRequired),
    deposits.map((x) => ({ kind: x.kind, amountCents: toCents(x.amount), voided: !!x.voided_at })));
  return { payments, charges, deposits, balance, deposit };
}

async function reservationInfo(id: string) {
  const sb = await createClient();
  const { data, error } = await sb.from("reservations").select("id,company_id,currency,status").eq("id", id).maybeSingle();
  if (error) mapError(error);
  if (!data) throw new ValidationError("Reserva no encontrada");
  return data as { id: string; company_id: string; currency: "DOP" | "USD"; status: string };
}

export async function createPayment(reservationId: string, input: PaymentInput) {
  // Reembolsar es sensible: exige el permiso de anulación (administrador por defecto). SUPUESTO S9.
  await requirePermission(input.kind === "refund" ? "payments:void" : "payments:write");
  const r = await reservationInfo(reservationId);
  if (r.status === "rejected") throw new ValidationError("No se registran pagos en una reserva rechazada");
  const sb = await createClient();
  const { error } = await sb.from("payments").insert({
    company_id: r.company_id, reservation_id: r.id, kind: input.kind, method: input.method, amount: input.amount,
    currency: r.currency, reference: input.reference ?? null, note: input.note ?? null,
  });
  if (error) mapError(error);
}

export async function createCharge(reservationId: string, description: string, amount: string) {
  await requirePermission("payments:write");
  const r = await reservationInfo(reservationId);
  const sb = await createClient();
  const { error } = await sb.from("reservation_charges").insert({ company_id: r.company_id, reservation_id: r.id, description, amount, currency: r.currency });
  if (error) mapError(error);
}

export async function createDepositMovement(reservationId: string, input: DepositInput) {
  // Aplicar parte del depósito a cargos es una deducción: exige payments:void (administrador). SUPUESTO S9.
  await requirePermission(input.kind === "applied" ? "payments:void" : "payments:write");
  const r = await reservationInfo(reservationId);
  const sb = await createClient();
  const { error } = await sb.from("deposit_movements").insert({
    company_id: r.company_id, reservation_id: r.id, kind: input.kind, method: input.method ?? null, amount: input.amount,
    currency: r.currency, reference: input.reference ?? null, note: input.note ?? null,
  });
  if (error) mapError(error);
}

export type VoidTarget = "payments" | "reservation_charges" | "deposit_movements";
export async function voidRecord(table: VoidTarget, id: string, reason: string) {
  const ctx = await requirePermission("payments:void");
  const sb = await createClient();
  const { data, error } = await sb.from(table).update({ voided_at: new Date().toISOString(), voided_by: ctx.userId, void_reason: reason })
    .eq("id", id).is("voided_at", null).select("id");
  if (error) mapError(error);
  if (!data || data.length === 0) throw new ValidationError("El registro no existe o ya estaba anulado");
}
