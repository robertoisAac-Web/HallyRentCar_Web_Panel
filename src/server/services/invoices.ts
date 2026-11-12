import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { fromCents, toCents } from "@/lib/money";
import { businessYmd, formatBusinessDateTime } from "@/lib/dates";

export type InvoiceComputedStatus = "paid" | "partial" | "pending" | "overdue" | "voided";
export type FiscalType = "none" | "B01" | "B02" | "B14" | "B15" | "E31" | "E32" | "E44" | "E45";
export type DocumentScope = "internal" | "fiscal_ncf" | "fiscal_ecf";

export const INVOICE_STATUS_LABEL: Record<InvoiceComputedStatus, string> = {
  paid: "Pagada",
  partial: "Pago parcial",
  pending: "Pendiente",
  overdue: "Vencida",
  voided: "Anulada",
};

export const INVOICE_STATUS_TONE: Record<InvoiceComputedStatus, string> = {
  paid: "green",
  partial: "blue",
  pending: "amber",
  overdue: "red",
  voided: "gray",
};

export const FISCAL_TYPE_LABEL: Record<FiscalType, string> = {
  none: "Factura Interna (Sin NCF / Control Interno)",
  B01: "B01 · Crédito Fiscal (NCF Tradicional)",
  B02: "B02 · Consumo Final (NCF Tradicional)",
  B14: "B14 · Regímenes Especiales (NCF)",
  B15: "B15 · Gubernamental (NCF)",
  E31: "E31 · Crédito Fiscal Electrónico (e-CF)",
  E32: "E32 · Consumo Electrónico (e-CF)",
  E44: "E44 · Regímenes Especiales Electrónico (e-CF)",
  E45: "E45 · Gubernamental Electrónico (e-CF)",
};

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  item_type: "rental" | "extra" | "service" | "other";
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  sort_order: number;
}

export interface InvoicePaymentRow {
  id: string;
  receipt_number: string | null;
  invoice_id: string | null;
  reservation_id: string | null;
  kind: "advance" | "payment" | "refund";
  method: string;
  amount: string;
  currency: "DOP" | "USD";
  reference: string | null;
  note: string | null;
  paid_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export interface InvoiceRow {
  id: string;
  company_id: string;
  code: string;
  reservation_id: string | null;
  customer_id: string;
  vehicle_id: string | null;
  source: "reservation" | "manual";
  issue_date: string;
  due_date: string;
  currency: "DOP" | "USD";
  subtotal: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  document_scope: DocumentScope;
  fiscal_type: FiscalType;
  ncf_or_ecf: string | null;
  ncf_expiration_date: string | null;
  security_code: string | null;
  dgii_status: "not_applicable" | "pending_integration" | "issued" | "voided";
  customer_tax_id: string | null;
  customer_tax_name: string | null;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface EnrichedInvoice extends InvoiceRow {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_doc: string | null;
  reservation_code: string | null;
  vehicle_label: string | null;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  computed_status: InvoiceComputedStatus;
}

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23514" || e.code === "P0001") {
    throw new ValidationError(e.message.replace(/^.*?:\s*/, "") || "Operación no permitida");
  }
  if (e.code === "42501") throw new ValidationError("No tienes permiso para esta operación");
  console.error("invoices service error:", e);
  throw new Error(e.message || "No se pudo completar la operación de facturación");
}

export function computeInvoiceStatus(
  inv: { issue_date: string; due_date: string; voided_at: string | null },
  totalCents: number,
  paidCents: number,
  todayYmd: string
): InvoiceComputedStatus {
  if (inv.voided_at) return "voided";
  if (totalCents - paidCents <= 0) return "paid";
  if (inv.due_date < todayYmd) return "overdue";
  if (paidCents > 0) return "partial";
  return "pending";
}

export interface InvoiceFilterParams {
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  q?: string;
}

export async function listInvoices(filters: InvoiceFilterParams = {}) {
  await requirePermission("payments:read");
  const sb = await createClient();

  let query = sb
    .from("invoices")
    .select("*")
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (filters.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }
  if (filters.from) {
    query = query.gte("issue_date", filters.from);
  }
  if (filters.to) {
    query = query.lte("issue_date", filters.to);
  }

  const { data: rows, error } = await query;
  if (error) mapError(error);
  const invoices = (rows ?? []) as InvoiceRow[];

  if (invoices.length === 0) {
    return {
      invoices: [] as EnrichedInvoice[],
      summary: {
        DOP: { billedCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 },
        USD: { billedCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 },
        counts: { total: 0, paid: 0, pending: 0, overdue: 0, voided: 0 },
      },
    };
  }

  const cIds = [...new Set(invoices.map((i) => i.customer_id))];
  const rIds = [...new Set(invoices.map((i) => i.reservation_id).filter(Boolean) as string[])];
  const vIds = [...new Set(invoices.map((i) => i.vehicle_id).filter(Boolean) as string[])];
  const invIds = invoices.map((i) => i.id);

  const [csRes, rsRes, vsRes, payByInvRes, payByResRes] = await Promise.all([
    sb.from("customers").select("id,full_name,phone,email,id_type,id_number").in("id", cIds),
    rIds.length > 0 ? sb.from("reservations").select("id,code").in("id", rIds) : Promise.resolve({ data: [] }),
    vIds.length > 0 ? sb.from("vehicles").select("id,make,model,year,plate").in("id", vIds) : Promise.resolve({ data: [] }),
    sb.from("payments").select("id,invoice_id,reservation_id,kind,amount,voided_at").in("invoice_id", invIds),
    rIds.length > 0
      ? sb.from("payments").select("id,invoice_id,reservation_id,kind,amount,voided_at").in("reservation_id", rIds)
      : Promise.resolve({ data: [] }),
  ]);

  const customerMap = new Map(
    (csRes.data ?? []).map((c) => [
      c.id as string,
      {
        name: c.full_name as string,
        phone: (c.phone as string | null) ?? null,
        email: (c.email as string | null) ?? null,
        doc: (c.id_number as string | null) ?? null,
      },
    ])
  );
  const resMap = new Map((rsRes.data ?? []).map((r) => [r.id as string, r.code as string]));
  const vehMap = new Map(
    (vsRes.data ?? []).map((v) => [v.id as string, `${v.make} ${v.model} ${v.year} (${v.plate})`])
  );

  // Unificar pagos por id para no duplicar si tienen tanto invoice_id como reservation_id
  const allPaymentsMap = new Map<
    string,
    { id: string; invoice_id: string | null; reservation_id: string | null; kind: string; amount: string; voided_at: string | null }
  >();
  for (const p of [...(payByInvRes.data ?? []), ...(payByResRes.data ?? [])]) {
    allPaymentsMap.set(p.id as string, p as {
      id: string;
      invoice_id: string | null;
      reservation_id: string | null;
      kind: string;
      amount: string;
      voided_at: string | null;
    });
  }
  const allPayments = [...allPaymentsMap.values()];

  const today = businessYmd(new Date());

  let enriched: EnrichedInvoice[] = invoices.map((inv) => {
    const cust = customerMap.get(inv.customer_id);
    const relatedPayments = allPayments.filter(
      (p) => !p.voided_at && (p.invoice_id === inv.id || (inv.reservation_id && p.reservation_id === inv.reservation_id))
    );
    const paidCents = relatedPayments.reduce((acc, p) => {
      const c = toCents(p.amount);
      return p.kind === "refund" ? acc - c : acc + c;
    }, 0);
    const totalCents = toCents(inv.total_amount);
    const balanceCents = Math.max(0, totalCents - paidCents);
    const computed_status = computeInvoiceStatus(inv, totalCents, paidCents, today);

    return {
      ...inv,
      customer_name: cust?.name ?? inv.customer_tax_name ?? "Cliente",
      customer_phone: cust?.phone ?? null,
      customer_email: cust?.email ?? null,
      customer_doc: inv.customer_tax_id ?? cust?.doc ?? null,
      reservation_code: inv.reservation_id ? resMap.get(inv.reservation_id) ?? null : null,
      vehicle_label: inv.vehicle_id ? vehMap.get(inv.vehicle_id) ?? null : null,
      total_cents: totalCents,
      paid_cents: Math.max(0, paidCents),
      balance_cents: inv.voided_at ? 0 : balanceCents,
      computed_status,
    };
  });

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    enriched = enriched.filter(
      (i) =>
        i.code.toLowerCase().includes(q) ||
        i.customer_name.toLowerCase().includes(q) ||
        (i.customer_doc && i.customer_doc.toLowerCase().includes(q)) ||
        (i.ncf_or_ecf && i.ncf_or_ecf.toLowerCase().includes(q)) ||
        (i.reservation_code && i.reservation_code.toLowerCase().includes(q))
    );
  }

  // Calcular resumen sobre el conjunto filtrado por fecha/cliente/búsqueda
  const summary = {
    DOP: { billedCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 },
    USD: { billedCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 },
    counts: { total: 0, paid: 0, pending: 0, overdue: 0, voided: 0 },
  };

  for (const inv of enriched) {
    summary.counts.total += 1;
    if (inv.computed_status === "voided") {
      summary.counts.voided += 1;
      continue;
    }
    const bucket = summary[inv.currency];
    bucket.billedCents += inv.total_cents;
    bucket.paidCents += Math.min(inv.paid_cents, inv.total_cents);
    bucket.pendingCents += inv.balance_cents;

    if (inv.computed_status === "paid") {
      summary.counts.paid += 1;
    } else if (inv.computed_status === "overdue") {
      summary.counts.overdue += 1;
      summary.counts.pending += 1;
      bucket.overdueCents += inv.balance_cents;
    } else {
      summary.counts.pending += 1;
    }
  }

  if (filters.status && filters.status !== "all") {
    if (filters.status === "pending") {
      enriched = enriched.filter((i) => i.computed_status === "pending" || i.computed_status === "partial");
    } else {
      enriched = enriched.filter((i) => i.computed_status === filters.status);
    }
  }

  return { invoices: enriched, summary };
}

export async function getInvoiceDetail(id: string) {
  const ctx = await requirePermission("payments:read");
  const sb = await createClient();

  const { data: inv, error } = await sb.from("invoices").select("*").eq("id", id).maybeSingle();
  if (error) mapError(error);
  if (!inv) return null;
  const invoice = inv as InvoiceRow;

  const [itemsRes, custRes, vehRes, resRes, compRes, payInvRes, payResRes] = await Promise.all([
    sb.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("sort_order"),
    sb.from("customers").select("*").eq("id", invoice.customer_id).maybeSingle(),
    invoice.vehicle_id ? sb.from("vehicles").select("*").eq("id", invoice.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    invoice.reservation_id ? sb.from("reservations").select("*").eq("id", invoice.reservation_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("companies").select("*").eq("id", ctx.companyId).single(),
    sb.from("payments").select("*").eq("invoice_id", invoice.id).order("paid_at"),
    invoice.reservation_id
      ? sb.from("payments").select("*").eq("reservation_id", invoice.reservation_id).order("paid_at")
      : Promise.resolve({ data: [] }),
  ]);

  const paymentMap = new Map<string, InvoicePaymentRow>();
  for (const p of [...(payInvRes.data ?? []), ...(payResRes.data ?? [])]) {
    paymentMap.set(p.id as string, p as InvoicePaymentRow);
  }
  const payments = [...paymentMap.values()].sort((a, b) => a.paid_at.localeCompare(b.paid_at));

  const paidCents = payments
    .filter((p) => !p.voided_at)
    .reduce((acc, p) => {
      const c = toCents(p.amount);
      return p.kind === "refund" ? acc - c : acc + c;
    }, 0);

  const totalCents = toCents(invoice.total_amount);
  const balanceCents = invoice.voided_at ? 0 : Math.max(0, totalCents - paidCents);
  const computedStatus = computeInvoiceStatus(invoice, totalCents, paidCents, businessYmd(new Date()));

  return {
    invoice,
    items: (itemsRes.data ?? []) as InvoiceItemRow[],
    customer: custRes.data as {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      id_type: string | null;
      id_number: string | null;
      address?: string | null;
    } | null,
    vehicle: vehRes.data as {
      id: string;
      make: string;
      model: string;
      year: number;
      plate: string;
    } | null,
    reservation: resRes.data as {
      id: string;
      code: string;
      pickup_at: string;
      return_at: string;
      pickup_location: string | null;
      return_location: string | null;
      billable_days: number;
      daily_rate: string;
    } | null,
    company: compRes.data as {
      id: string;
      name: string;
      legal_name: string | null;
      rnc: string | null;
      phone: string | null;
      whatsapp_number: string | null;
      address: string | null;
      tagline: string | null;
    },
    payments,
    totals: {
      subtotalCents: toCents(invoice.subtotal),
      discountCents: toCents(invoice.discount_amount),
      taxCents: toCents(invoice.tax_amount),
      totalCents,
      paidCents: Math.max(0, paidCents),
      balanceCents,
      computedStatus,
    },
  };
}

export async function getInvoiceByReservation(reservationId: string) {
  await requirePermission("payments:read");
  const sb = await createClient();
  const { data } = await sb
    .from("invoices")
    .select("id,code,total_amount,currency,voided_at")
    .eq("reservation_id", reservationId)
    .is("voided_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; code: string; total_amount: string; currency: "DOP" | "USD"; voided_at: string | null } | null;
}

export async function createInvoiceFromReservation(
  reservationId: string,
  opts?: {
    taxRate?: number;
    dueDays?: number;
    fiscalType?: FiscalType;
    ncfOrEcf?: string;
    customerTaxId?: string;
    customerTaxName?: string;
    notes?: string;
  }
): Promise<{ id: string }> {
  const ctx = await requirePermission("payments:write");
  const sb = await createClient();

  // Si ya tiene una factura activa, devolverla
  const existing = await getInvoiceByReservation(reservationId);
  if (existing) {
    return { id: existing.id };
  }

  const { data: r, error: rErr } = await sb.from("reservations").select("*").eq("id", reservationId).maybeSingle();
  if (rErr) mapError(rErr);
  if (!r) throw new ValidationError("Reserva no encontrada");

  const [{ data: cust }, { data: veh }, { data: charges }] = await Promise.all([
    sb.from("customers").select("*").eq("id", r.customer_id).maybeSingle(),
    sb.from("vehicles").select("*").eq("id", r.vehicle_id).maybeSingle(),
    sb.from("reservation_charges").select("*").eq("reservation_id", reservationId).is("voided_at", null).order("created_at"),
  ]);

  const itemsToInsert: {
    item_type: "rental" | "extra" | "service" | "other";
    description: string;
    quantity: string;
    unit_price: string;
    line_total: string;
    sort_order: number;
  }[] = [];

  const vehLabel = veh ? `${veh.make} ${veh.model} ${veh.year} (Placa ${veh.plate})` : "Vehículo";
  const rentalLineTotalCents = toCents(r.daily_rate) * Number(r.billable_days);
  itemsToInsert.push({
    item_type: "rental",
    description: `Alquiler de ${vehLabel} · Del ${formatBusinessDateTime(r.pickup_at)} al ${formatBusinessDateTime(r.return_at)}`,
    quantity: Number(r.billable_days).toFixed(2),
    unit_price: fromCents(toCents(r.daily_rate)),
    line_total: fromCents(rentalLineTotalCents),
    sort_order: 1,
  });

  let sortOrder = 2;
  const extrasCents = toCents(r.extras_total ?? "0");
  if (extrasCents > 0) {
    itemsToInsert.push({
      item_type: "extra",
      description: "Servicios y extras incluidos en la reserva",
      quantity: "1.00",
      unit_price: fromCents(extrasCents),
      line_total: fromCents(extrasCents),
      sort_order: sortOrder++,
    });
  }

  for (const ch of charges ?? []) {
    const chCents = toCents(ch.amount);
    if (chCents > 0) {
      itemsToInsert.push({
        item_type: "extra",
        description: `Cargo adicional: ${ch.description}`,
        quantity: "1.00",
        unit_price: fromCents(chCents),
        line_total: fromCents(chCents),
        sort_order: sortOrder++,
      });
    }
  }

  const subtotalCents = itemsToInsert.reduce((s, item) => s + toCents(item.line_total), 0);
  const discountCents = Math.min(subtotalCents, toCents(r.discount_total ?? "0"));
  const taxableBaseCents = Math.max(0, subtotalCents - discountCents);
  const taxRate = opts?.taxRate ?? 0;
  const taxCents = Math.round((taxableBaseCents * taxRate) / 100);
  const totalCents = taxableBaseCents + taxCents;

  const issueDate = businessYmd(new Date());
  const dueDays = opts?.dueDays ?? 7;
  const dueDateObj = new Date(Date.now() + dueDays * 86400_000);
  const dueDate = businessYmd(dueDateObj);

  const fiscalType: FiscalType = opts?.fiscalType ?? "none";
  const cleanNcf = opts?.ncfOrEcf?.trim() || null;
  const docScope: DocumentScope = cleanNcf
    ? fiscalType.startsWith("E")
      ? "fiscal_ecf"
      : "fiscal_ncf"
    : "internal";

  const { data: created, error: insErr } = await sb
    .from("invoices")
    .insert({
      company_id: ctx.companyId,
      code: "",
      reservation_id: r.id,
      customer_id: r.customer_id,
      vehicle_id: r.vehicle_id,
      source: "reservation",
      issue_date: issueDate,
      due_date: dueDate,
      currency: r.currency,
      subtotal: fromCents(subtotalCents),
      discount_amount: fromCents(discountCents),
      tax_rate: taxRate.toFixed(2),
      tax_amount: fromCents(taxCents),
      total_amount: fromCents(totalCents),
      document_scope: docScope,
      fiscal_type: fiscalType,
      ncf_or_ecf: cleanNcf,
      dgii_status: cleanNcf ? "issued" : fiscalType !== "none" ? "pending_integration" : "not_applicable",
      customer_tax_id: opts?.customerTaxId?.trim() || cust?.id_number || null,
      customer_tax_name: opts?.customerTaxName?.trim() || cust?.full_name || null,
      notes: opts?.notes?.trim() || r.internal_notes || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (insErr || !created) mapError(insErr ?? { message: "No se pudo crear la factura" });

  const { error: itemsErr } = await sb.from("invoice_items").insert(
    itemsToInsert.map((it) => ({
      ...it,
      company_id: ctx.companyId,
      invoice_id: created.id,
    }))
  );
  if (itemsErr) mapError(itemsErr);

  // Vincular pagos previos de esa reserva a esta factura
  await sb
    .from("payments")
    .update({ invoice_id: created.id })
    .eq("reservation_id", reservationId)
    .is("invoice_id", null);

  return { id: created.id as string };
}

export interface ManualInvoiceInput {
  customer_id?: string;
  new_customer_name?: string;
  new_customer_phone?: string;
  new_customer_email?: string;
  new_customer_doc_type?: "cedula" | "passport" | "other";
  new_customer_doc_number?: string;
  vehicle_id?: string;
  reservation_id?: string;
  issue_date: string;
  due_date: string;
  currency: "DOP" | "USD";
  discount_amount: string;
  tax_rate: number;
  fiscal_type: FiscalType;
  ncf_or_ecf?: string;
  ncf_expiration_date?: string;
  security_code?: string;
  customer_tax_id?: string;
  customer_tax_name?: string;
  notes?: string;
  items: {
    item_type: "rental" | "extra" | "service" | "other";
    description: string;
    quantity: number;
    unit_price: string;
  }[];
  initial_payment_amount?: string;
  initial_payment_method?: "cash" | "transfer" | "card" | "other";
  initial_payment_reference?: string;
}

export async function createManualInvoice(input: ManualInvoiceInput): Promise<{ id: string }> {
  const ctx = await requirePermission("payments:write");
  const sb = await createClient();

  let customerId = input.customer_id?.trim() || "";
  let customerName = input.customer_tax_name?.trim() || "";
  let customerDoc = input.customer_tax_id?.trim() || "";

  if (!customerId) {
    const name = input.new_customer_name?.trim() ?? "";
    if (name.length < 2) {
      throw new ValidationError("Selecciona un cliente existente o escribe el nombre del cliente nuevo");
    }
    const docNum = input.new_customer_doc_number?.trim() || null;
    const docType = docNum ? input.new_customer_doc_type ?? "cedula" : null;
    const { data: newCust, error: cErr } = await sb
      .from("customers")
      .insert({
        company_id: ctx.companyId,
        full_name: name,
        phone: input.new_customer_phone?.trim() || null,
        email: input.new_customer_email?.trim() || null,
        id_type: docType,
        id_number: docNum,
      })
      .select("id,full_name,id_number")
      .single();
    if (cErr || !newCust) mapError(cErr ?? { message: "No se pudo registrar el cliente" });
    customerId = newCust.id as string;
    if (!customerName) customerName = newCust.full_name as string;
    if (!customerDoc && newCust.id_number) customerDoc = newCust.id_number as string;
  } else {
    const { data: existingCust } = await sb
      .from("customers")
      .select("full_name,id_number")
      .eq("id", customerId)
      .maybeSingle();
    if (!customerName && existingCust?.full_name) customerName = existingCust.full_name as string;
    if (!customerDoc && existingCust?.id_number) customerDoc = existingCust.id_number as string;
  }

  const validItems = input.items.filter((i) => i.description.trim().length > 0 && i.quantity > 0);
  if (validItems.length === 0) {
    throw new ValidationError("Agrega al menos un concepto o línea de facturación");
  }

  const preparedItems = validItems.map((it, idx) => {
    const unitCents = toCents(it.unit_price || "0");
    if (unitCents < 0) throw new ValidationError("El precio unitario no puede ser negativo");
    const qty = Math.round(it.quantity * 100) / 100;
    const lineCents = Math.round(qty * unitCents);
    return {
      item_type: it.item_type,
      description: it.description.trim(),
      quantity: qty.toFixed(2),
      unit_price: fromCents(unitCents),
      line_total: fromCents(lineCents),
      line_cents: lineCents,
      sort_order: idx + 1,
    };
  });

  const subtotalCents = preparedItems.reduce((s, it) => s + it.line_cents, 0);
  const discountCents = Math.max(0, toCents(input.discount_amount || "0"));
  if (discountCents > subtotalCents) {
    throw new ValidationError("El descuento no puede superar el subtotal de la factura");
  }

  const taxableBaseCents = subtotalCents - discountCents;
  const taxRate = Math.max(0, Math.min(100, Number(input.tax_rate) || 0));
  const taxCents = Math.round((taxableBaseCents * taxRate) / 100);
  const totalCents = taxableBaseCents + taxCents;

  if (input.due_date < input.issue_date) {
    throw new ValidationError("La fecha de vencimiento no puede ser anterior a la fecha de emisión");
  }

  const cleanNcf = input.ncf_or_ecf?.trim() || null;
  const docScope: DocumentScope = cleanNcf
    ? input.fiscal_type.startsWith("E")
      ? "fiscal_ecf"
      : "fiscal_ncf"
    : "internal";

  const { data: created, error: insErr } = await sb
    .from("invoices")
    .insert({
      company_id: ctx.companyId,
      code: "",
      reservation_id: input.reservation_id?.trim() || null,
      customer_id: customerId,
      vehicle_id: input.vehicle_id?.trim() || null,
      source: input.reservation_id ? "reservation" : "manual",
      issue_date: input.issue_date,
      due_date: input.due_date,
      currency: input.currency,
      subtotal: fromCents(subtotalCents),
      discount_amount: fromCents(discountCents),
      tax_rate: taxRate.toFixed(2),
      tax_amount: fromCents(taxCents),
      total_amount: fromCents(totalCents),
      document_scope: docScope,
      fiscal_type: input.fiscal_type,
      ncf_or_ecf: cleanNcf,
      ncf_expiration_date: input.ncf_expiration_date?.trim() || null,
      security_code: input.security_code?.trim() || null,
      dgii_status: cleanNcf ? "issued" : input.fiscal_type !== "none" ? "pending_integration" : "not_applicable",
      customer_tax_id: customerDoc || null,
      customer_tax_name: customerName || null,
      notes: input.notes?.trim() || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (insErr || !created) mapError(insErr ?? { message: "No se pudo guardar la factura" });

  const { error: itemErr } = await sb.from("invoice_items").insert(
    preparedItems.map((it) => ({
      company_id: ctx.companyId,
      invoice_id: created.id,
      item_type: it.item_type,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: it.line_total,
      sort_order: it.sort_order,
    }))
  );
  if (itemErr) mapError(itemErr);

  // Si se indicó un pago inicial (completo o parcial)
  if (input.initial_payment_amount && input.initial_payment_amount.trim() !== "") {
    const payCents = toCents(input.initial_payment_amount);
    if (payCents > 0) {
      const method = input.initial_payment_method ?? "cash";
      const ref = input.initial_payment_reference?.trim() || (method === "cash" ? null : "PAGO-INICIAL");
      const { error: pErr } = await sb.from("payments").insert({
        company_id: ctx.companyId,
        invoice_id: created.id,
        reservation_id: input.reservation_id?.trim() || null,
        kind: "payment",
        method,
        amount: fromCents(payCents),
        currency: input.currency,
        reference: ref,
        note: "Pago registrado al emitir factura",
      });
      if (pErr) mapError(pErr);
    }
  }

  return { id: created.id as string };
}

export async function recordInvoicePayment(
  invoiceId: string,
  input: {
    kind: "advance" | "payment" | "refund";
    method: "cash" | "transfer" | "card" | "other";
    amount: string;
    reference?: string;
    note?: string;
  }
) {
  await requirePermission(input.kind === "refund" ? "payments:void" : "payments:write");
  const sb = await createClient();

  const { data: inv, error: invErr } = await sb
    .from("invoices")
    .select("id,company_id,reservation_id,currency,voided_at")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr) mapError(invErr);
  if (!inv) throw new ValidationError("Factura no encontrada");
  if (inv.voided_at) throw new ValidationError("No se pueden registrar pagos en una factura anulada");

  const amountCents = toCents(input.amount);
  if (amountCents <= 0) throw new ValidationError("El importe del pago debe ser mayor a cero");

  const ref = input.reference?.trim() || null;
  if (input.method !== "cash" && !ref) {
    throw new ValidationError("La referencia es obligatoria para pagos por transferencia, tarjeta u otro medio");
  }

  const { error } = await sb.from("payments").insert({
    company_id: inv.company_id,
    invoice_id: inv.id,
    reservation_id: inv.reservation_id ?? null,
    kind: input.kind,
    method: input.method,
    amount: fromCents(amountCents),
    currency: inv.currency,
    reference: ref,
    note: input.note?.trim() || null,
  });
  if (error) mapError(error);
}

export async function voidInvoice(invoiceId: string, reason: string) {
  const ctx = await requirePermission("payments:void");
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) {
    throw new ValidationError("Indica el motivo de la anulación (mínimo 3 caracteres)");
  }
  const sb = await createClient();
  const { data, error } = await sb
    .from("invoices")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: ctx.userId,
      void_reason: cleanReason,
      dgii_status: "voided",
    })
    .eq("id", invoiceId)
    .is("voided_at", null)
    .select("id");
  if (error) mapError(error);
  if (!data || data.length === 0) throw new ValidationError("La factura no existe o ya estaba anulada");
}
