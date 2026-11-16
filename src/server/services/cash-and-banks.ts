import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { fromCents, toCents } from "@/lib/money";
import { createInvoiceFromReservation, getInvoiceByReservation } from "./invoices";

export interface BankAccountRow {
  id: string;
  company_id: string;
  bank_name: string;
  account_label: string;
  account_number_masked: string | null;
  currency: "DOP" | "USD";
  is_active: boolean;
}

export interface CashShiftRow {
  id: string;
  company_id: string;
  code: string;
  cashier_user_id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
  opening_amount_dop: string;
  opening_amount_usd: string;
  expected_cash_dop: string;
  expected_cash_usd: string;
  counted_cash_dop: string | null;
  counted_cash_usd: string | null;
  difference_dop: string | null;
  difference_usd: string | null;
  notes: string | null;
  closing_notes: string | null;
}

export interface ShiftLiveSummary {
  shift: CashShiftRow;
  cashier_name: string;
  live_cash_in_dop_cents: number;
  live_cash_out_dop_cents: number;
  live_expected_dop_cents: number;
  live_cash_in_usd_cents: number;
  live_cash_out_usd_cents: number;
  live_expected_usd_cents: number;
  transfer_dop_cents: number;
  card_dop_cents: number;
  payments_count: number;
}

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23505") {
    throw new ValidationError("Ya tienes un turno de caja abierto actualmente.");
  }
  if (e.code === "23514" || e.code === "P0001") {
    throw new ValidationError(e.message.replace(/^.*?:\s*/, "") || "Operación no permitida");
  }
  console.error("cash-and-banks error:", e);
  throw new Error(e.message || "Error en operación de caja y bancos");
}

export async function listBankAccounts(onlyActive = true): Promise<BankAccountRow[]> {
  await requirePermission("payments:read");
  const sb = await createClient();
  let q = sb.from("bank_accounts").select("*").order("bank_name");
  if (onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) mapError(error);
  return (data ?? []) as BankAccountRow[];
}

export async function createBankAccount(input: {
  bank_name: string;
  account_label: string;
  account_number_masked?: string;
  currency: "DOP" | "USD";
}) {
  const ctx = await requirePermission("payments:write");
  const bankName = input.bank_name.trim();
  const label = input.account_label.trim();
  if (!bankName || !label) {
    throw new ValidationError("Indica el nombre del banco y la descripción de la cuenta");
  }
  const sb = await createClient();
  const { error } = await sb.from("bank_accounts").insert({
    company_id: ctx.companyId,
    bank_name: bankName,
    account_label: label,
    account_number_masked: input.account_number_masked?.trim() || null,
    currency: input.currency,
    is_active: true,
  });
  if (error) mapError(error);
}

export async function deleteBankAccount(id: string) {
  const ctx = await requirePermission("payments:write");
  const sb = await createClient();
  const { error } = await sb
    .from("bank_accounts")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId);
  if (error) mapError(error);
}

export async function getActiveShiftForCurrentUser(): Promise<ShiftLiveSummary | null> {
  const ctx = await requirePermission("payments:read");
  const sb = await createClient();

  // Buscar turno abierto del usuario actual o el turno abierto activo de la empresa
  const { data: openShifts, error } = await sb
    .from("cash_shifts")
    .select("*")
    .eq("company_id", ctx.companyId)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (error) mapError(error);
  if (!openShifts || openShifts.length === 0) return null;

  const myShift =
    (openShifts.find((s) => s.cashier_user_id === ctx.userId) as CashShiftRow | undefined) ??
    (openShifts[0] as CashShiftRow);

  return computeShiftSummary(myShift);
}

async function computeShiftSummary(shift: CashShiftRow): Promise<ShiftLiveSummary> {
  const sb = await createClient();
  const [{ data: profile }, { data: payments }] = await Promise.all([
    sb.from("profiles").select("full_name").eq("id", shift.cashier_user_id).maybeSingle(),
    sb
      .from("payments")
      .select("id,kind,method,amount,currency,voided_at,paid_at")
      .eq("cash_shift_id", shift.id)
      .is("voided_at", null),
  ]);

  let cashInDop = 0;
  let cashOutDop = 0;
  let cashInUsd = 0;
  let cashOutUsd = 0;
  let transferDop = 0;
  let cardDop = 0;

  for (const p of payments ?? []) {
    const c = toCents(p.amount as string);
    if (p.currency === "DOP") {
      if (p.method === "cash") {
        if (p.kind === "refund") cashOutDop += c;
        else cashInDop += c;
      } else if (p.method === "transfer") {
        transferDop += p.kind === "refund" ? -c : c;
      } else if (p.method === "card") {
        cardDop += p.kind === "refund" ? -c : c;
      }
    } else if (p.currency === "USD" && p.method === "cash") {
      if (p.kind === "refund") cashOutUsd += c;
      else cashInUsd += c;
    }
  }

  const openDop = toCents(shift.opening_amount_dop);
  const openUsd = toCents(shift.opening_amount_usd);

  return {
    shift,
    cashier_name: (profile?.full_name as string | null) ?? "Cajero Principal",
    live_cash_in_dop_cents: cashInDop,
    live_cash_out_dop_cents: cashOutDop,
    live_expected_dop_cents: openDop + cashInDop - cashOutDop,
    live_cash_in_usd_cents: cashInUsd,
    live_cash_out_usd_cents: cashOutUsd,
    live_expected_usd_cents: openUsd + cashInUsd - cashOutUsd,
    transfer_dop_cents: transferDop,
    card_dop_cents: cardDop,
    payments_count: (payments ?? []).length,
  };
}

export async function listCashShifts(): Promise<ShiftLiveSummary[]> {
  await requirePermission("payments:read");
  const sb = await createClient();
  const { data, error } = await sb
    .from("cash_shifts")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(50);
  if (error) mapError(error);
  const rows = (data ?? []) as CashShiftRow[];
  return Promise.all(rows.map((r) => computeShiftSummary(r)));
}

export async function openCashShift(input: {
  opening_amount_dop: string;
  opening_amount_usd?: string;
  notes?: string;
}) {
  const ctx = await requirePermission("payments:write");
  const dopCents = Math.max(0, toCents(input.opening_amount_dop || "0"));
  const usdCents = Math.max(0, toCents(input.opening_amount_usd || "0"));

  const sb = await createClient();
  const { error } = await sb.from("cash_shifts").insert({
    company_id: ctx.companyId,
    code: "",
    cashier_user_id: ctx.userId,
    status: "open",
    opening_amount_dop: fromCents(dopCents),
    opening_amount_usd: fromCents(usdCents),
    expected_cash_dop: fromCents(dopCents),
    expected_cash_usd: fromCents(usdCents),
    notes: input.notes?.trim() || null,
  });
  if (error) mapError(error);
}

export async function closeCashShift(
  shiftId: string,
  input: {
    counted_cash_dop: string;
    counted_cash_usd?: string;
    closing_notes?: string;
  }
) {
  const ctx = await requirePermission("payments:write");
  const sb = await createClient();

  const { data: shift, error: sErr } = await sb
    .from("cash_shifts")
    .select("*")
    .eq("id", shiftId)
    .maybeSingle();
  if (sErr) mapError(sErr);
  if (!shift) throw new ValidationError("Turno de caja no encontrado");
  if (shift.status === "closed") throw new ValidationError("Este turno de caja ya fue cerrado");

  const summary = await computeShiftSummary(shift as CashShiftRow);
  const countedDopCents = Math.max(0, toCents(input.counted_cash_dop || "0"));
  const countedUsdCents = Math.max(0, toCents(input.counted_cash_usd || "0"));

  const diffDopCents = countedDopCents - summary.live_expected_dop_cents;
  const diffUsdCents = countedUsdCents - summary.live_expected_usd_cents;

  const { error: uErr } = await sb
    .from("cash_shifts")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: ctx.userId,
      expected_cash_dop: fromCents(summary.live_expected_dop_cents),
      expected_cash_usd: fromCents(summary.live_expected_usd_cents),
      counted_cash_dop: fromCents(countedDopCents),
      counted_cash_usd: fromCents(countedUsdCents),
      difference_dop: fromCents(diffDopCents),
      difference_usd: fromCents(diffUsdCents),
      closing_notes: input.closing_notes?.trim() || null,
    })
    .eq("id", shiftId)
    .eq("status", "open");

  if (uErr) mapError(uErr);
}

export interface MixedPaymentSplit {
  method: "cash" | "transfer" | "card" | "other";
  amount: string;
  bank_account_id?: string;
  bank_name?: string;
  reference?: string;
  note?: string;
}

/**
 * Registra un pago simple o mixto (ej. Efectivo + Transferencia Bancaria)
 * garantizando:
 * 1) Trazabilidad Contrato <-> Factura (si viene reservationId sin factura, genera la factura automáticamente).
 * 2) Trazabilidad de Efectivo en la Caja del Turno activo (cash_shift_id).
 * 3) Trazabilidad de Transferencias con Banco Receptor y Referencia para Conciliación.
 */
export async function recordMixedPayments(params: {
  reservationId?: string;
  invoiceId?: string;
  kind?: "advance" | "payment" | "refund";
  splits: MixedPaymentSplit[];
}) {
  const kind = params.kind ?? "payment";
  await requirePermission(kind === "refund" ? "payments:void" : "payments:write");

  const validSplits = params.splits.filter((s) => s.amount && toCents(s.amount) > 0);
  if (validSplits.length === 0) {
    throw new ValidationError("Ingresa al menos un monto de pago mayor a cero");
  }

  const sb = await createClient();
  let targetInvoiceId = params.invoiceId?.trim() || null;
  let targetReservationId = params.reservationId?.trim() || null;
  let companyId = "";
  let currency: "DOP" | "USD" = "DOP";

  // Si viene desde una reserva/contrato, asegurar que exista su factura para trazabilidad completa
  if (targetReservationId && !targetInvoiceId) {
    const existingInv = await getInvoiceByReservation(targetReservationId);
    if (existingInv) {
      targetInvoiceId = existingInv.id;
    } else {
      const createdInv = await createInvoiceFromReservation(targetReservationId);
      targetInvoiceId = createdInv.id;
    }
  }

  if (targetInvoiceId) {
    const { data: inv, error: invErr } = await sb
      .from("invoices")
      .select("id,company_id,reservation_id,currency,voided_at")
      .eq("id", targetInvoiceId)
      .maybeSingle();
    if (invErr) mapError(invErr);
    if (!inv) throw new ValidationError("Factura no encontrada");
    if (inv.voided_at) throw new ValidationError("No se pueden registrar pagos en una factura anulada");
    companyId = inv.company_id as string;
    currency = inv.currency as "DOP" | "USD";
    if (!targetReservationId && inv.reservation_id) {
      targetReservationId = inv.reservation_id as string;
    }
  } else if (targetReservationId) {
    const { data: res, error: rErr } = await sb
      .from("reservations")
      .select("id,company_id,currency,status")
      .eq("id", targetReservationId)
      .maybeSingle();
    if (rErr) mapError(rErr);
    if (!res) throw new ValidationError("Contrato / Reserva no encontrada");
    if (res.status === "rejected") throw new ValidationError("No se registran pagos en una reserva rechazada");
    companyId = res.company_id as string;
    currency = res.currency as "DOP" | "USD";
  } else {
    throw new ValidationError("Todo pago debe estar asociado a un contrato de reserva o factura");
  }

  // Verificar validaciones de cada tramo del pago mixto
  const activeShift = await getActiveShiftForCurrentUser();
  const groupId = validSplits.length > 1 ? randomUUID() : null;

  for (const split of validSplits) {
    const cents = toCents(split.amount);
    if (cents <= 0) throw new ValidationError("Cada tramo del pago debe tener un importe mayor a cero");

    if (split.method === "transfer") {
      if (!split.bank_account_id && !split.bank_name?.trim()) {
        throw new ValidationError("Para transferencias bancarias es obligatorio seleccionar el banco receptor");
      }
      if (!split.reference?.trim()) {
        throw new ValidationError("Para transferencias bancarias es obligatorio el número de referencia o aprobación");
      }
    } else if (split.method !== "cash" && !split.reference?.trim()) {
      throw new ValidationError("Indica el número de referencia o voucher para pagos con tarjeta u otro medio");
    }
  }

  for (const split of validSplits) {
    const cents = toCents(split.amount);
    const { error } = await sb.from("payments").insert({
      company_id: companyId,
      reservation_id: targetReservationId,
      invoice_id: targetInvoiceId,
      kind,
      method: split.method,
      amount: fromCents(cents),
      currency,
      bank_account_id: split.method === "transfer" ? split.bank_account_id?.trim() || null : null,
      bank_name: split.method === "transfer" ? split.bank_name?.trim() || null : null,
      cash_shift_id: split.method === "cash" ? activeShift?.shift.id ?? null : null,
      payment_group_id: groupId,
      reference: split.reference?.trim() || null,
      note:
        split.note?.trim() ||
        (validSplits.length > 1 ? `Pago mixto (${validSplits.length} métodos)` : null),
    });
    if (error) mapError(error);
  }
}

export interface TransferPaymentItem {
  id: string;
  receipt_number: string | null;
  invoice_id: string | null;
  invoice_code: string | null;
  reservation_id: string | null;
  reservation_code: string | null;
  customer_name: string;
  amount: string;
  currency: "DOP" | "USD";
  bank_name: string | null;
  reference: string | null;
  paid_at: string;
  reconciled_at: string | null;
  voided_at: string | null;
}

export async function listTransferPayments(filters?: {
  bank?: string;
  reconciled?: "all" | "pending" | "reconciled";
}): Promise<TransferPaymentItem[]> {
  await requirePermission("payments:read");
  const sb = await createClient();

  let q = sb
    .from("payments")
    .select("*")
    .eq("method", "transfer")
    .is("voided_at", null)
    .order("paid_at", { ascending: false })
    .limit(200);

  if (filters?.bank) {
    q = q.eq("bank_name", filters.bank);
  }
  if (filters?.reconciled === "pending") {
    q = q.is("reconciled_at", null);
  } else if (filters?.reconciled === "reconciled") {
    q = q.not("reconciled_at", "is", null);
  }

  const { data, error } = await q;
  if (error) mapError(error);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const invIds = [...new Set(rows.map((r) => r.invoice_id).filter(Boolean) as string[])];
  const resIds = [...new Set(rows.map((r) => r.reservation_id).filter(Boolean) as string[])];

  const [invsRes, ressRes] = await Promise.all([
    invIds.length > 0 ? sb.from("invoices").select("id,code,customer_id,customer_tax_name").in("id", invIds) : Promise.resolve({ data: [] }),
    resIds.length > 0 ? sb.from("reservations").select("id,code,customer_id").in("id", resIds) : Promise.resolve({ data: [] }),
  ]);

  const cIds = [
    ...new Set([
      ...(invsRes.data ?? []).map((i) => i.customer_id as string),
      ...(ressRes.data ?? []).map((r) => r.customer_id as string),
    ]),
  ];
  const { data: custs } = cIds.length > 0
    ? await sb.from("customers").select("id,full_name").in("id", cIds)
    : { data: [] };

  const custMap = new Map((custs ?? []).map((c) => [c.id as string, c.full_name as string]));
  const invMap = new Map(
    (invsRes.data ?? []).map((i) => [
      i.id as string,
      { code: i.code as string, customer_id: i.customer_id as string, tax_name: i.customer_tax_name as string | null },
    ])
  );
  const resMap = new Map(
    (ressRes.data ?? []).map((r) => [
      r.id as string,
      { code: r.code as string, customer_id: r.customer_id as string },
    ])
  );

  return rows.map((p) => {
    const inv = p.invoice_id ? invMap.get(p.invoice_id as string) : undefined;
    const res = p.reservation_id ? resMap.get(p.reservation_id as string) : undefined;
    const cId = inv?.customer_id ?? res?.customer_id;
    const customerName = (cId ? custMap.get(cId) : null) ?? inv?.tax_name ?? "Cliente";

    return {
      id: p.id as string,
      receipt_number: (p.receipt_number as string | null) ?? null,
      invoice_id: (p.invoice_id as string | null) ?? null,
      invoice_code: inv?.code ?? null,
      reservation_id: (p.reservation_id as string | null) ?? null,
      reservation_code: res?.code ?? null,
      customer_name: customerName,
      amount: p.amount as string,
      currency: (p.currency as "DOP" | "USD") ?? "DOP",
      bank_name: (p.bank_name as string | null) ?? "Transferencia Bancaria",
      reference: (p.reference as string | null) ?? null,
      paid_at: p.paid_at as string,
      reconciled_at: (p.reconciled_at as string | null) ?? null,
      voided_at: (p.voided_at as string | null) ?? null,
    };
  });
}

export async function reconcileTransferPayment(paymentId: string) {
  const ctx = await requirePermission("payments:write");
  const sb = await createClient();
  const { error } = await sb
    .from("payments")
    .update({
      reconciled_at: new Date().toISOString(),
      reconciled_by: ctx.userId,
    })
    .eq("id", paymentId)
    .is("reconciled_at", null);
  if (error) mapError(error);
}
