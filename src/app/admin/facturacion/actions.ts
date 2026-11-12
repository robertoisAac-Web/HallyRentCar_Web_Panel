"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import {
  createInvoiceFromReservation,
  createManualInvoice,
  recordInvoicePayment,
  voidInvoice,
  type FiscalType,
} from "@/server/services/invoices";
import { voidRecord } from "@/server/services/finance";

export async function generateFromReservationAction(reservationId: string, fd?: FormData) {
  let invoiceId = "";
  const taxRate = fd ? Number(fd.get("tax_rate") ?? 0) : 0;
  const dueDays = fd ? Number(fd.get("due_days") ?? 7) : 7;
  const fiscalType = (fd ? String(fd.get("fiscal_type") ?? "none") : "none") as FiscalType;
  const ncfOrEcf = fd ? String(fd.get("ncf_or_ecf") ?? "") : "";

  try {
    const res = await createInvoiceFromReservation(reservationId, {
      taxRate: Number.isFinite(taxRate) ? taxRate : 0,
      dueDays: Number.isFinite(dueDays) && dueDays >= 0 ? dueDays : 7,
      fiscalType,
      ncfOrEcf,
    });
    invoiceId = res.id;
  } catch (e) {
    redirect(`/admin/reservas/${reservationId}?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/facturacion");
  revalidatePath(`/admin/reservas/${reservationId}`);
  redirect(`/admin/facturacion/${invoiceId}?ok=1`);
}

export async function createManualInvoiceAction(fd: FormData) {
  let invoiceId = "";
  try {
    const itemsJson = String(fd.get("items_json") ?? "[]");
    const parsedItems = JSON.parse(itemsJson) as {
      item_type: "rental" | "extra" | "service" | "other";
      description: string;
      quantity: number;
      unit_price: string;
    }[];

    const res = await createManualInvoice({
      customer_id: String(fd.get("customer_id") ?? ""),
      new_customer_name: String(fd.get("new_customer_name") ?? ""),
      new_customer_phone: String(fd.get("new_customer_phone") ?? ""),
      new_customer_email: String(fd.get("new_customer_email") ?? ""),
      new_customer_doc_type: (String(fd.get("new_customer_doc_type") ?? "cedula") || "cedula") as
        | "cedula"
        | "passport"
        | "other",
      new_customer_doc_number: String(fd.get("new_customer_doc_number") ?? ""),
      vehicle_id: String(fd.get("vehicle_id") ?? ""),
      reservation_id: String(fd.get("reservation_id") ?? ""),
      issue_date: String(fd.get("issue_date") ?? ""),
      due_date: String(fd.get("due_date") ?? ""),
      currency: (String(fd.get("currency") ?? "DOP") === "USD" ? "USD" : "DOP"),
      discount_amount: String(fd.get("discount_amount") ?? "0"),
      tax_rate: Number(fd.get("tax_rate") ?? 0),
      fiscal_type: (String(fd.get("fiscal_type") ?? "none") || "none") as FiscalType,
      ncf_or_ecf: String(fd.get("ncf_or_ecf") ?? ""),
      ncf_expiration_date: String(fd.get("ncf_expiration_date") ?? ""),
      security_code: String(fd.get("security_code") ?? ""),
      customer_tax_id: String(fd.get("customer_tax_id") ?? ""),
      customer_tax_name: String(fd.get("customer_tax_name") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      items: parsedItems,
      initial_payment_amount: String(fd.get("initial_payment_amount") ?? ""),
      initial_payment_method: (String(fd.get("initial_payment_method") ?? "cash") || "cash") as
        | "cash"
        | "transfer"
        | "card"
        | "other",
      initial_payment_reference: String(fd.get("initial_payment_reference") ?? ""),
    });
    invoiceId = res.id;
  } catch (e) {
    redirect(`/admin/facturacion/nueva?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/facturacion");
  revalidatePath("/admin/reportes");
  redirect(`/admin/facturacion/${invoiceId}?ok=1`);
}

export async function recordInvoicePaymentAction(invoiceId: string, fd: FormData) {
  try {
    const kind = (String(fd.get("kind") ?? "payment") || "payment") as "advance" | "payment" | "refund";
    const method = (String(fd.get("method") ?? "cash") || "cash") as "cash" | "transfer" | "card" | "other";
    const amount = String(fd.get("amount") ?? "").trim();
    const reference = String(fd.get("reference") ?? "").trim();
    const note = String(fd.get("note") ?? "").trim();

    await recordInvoicePayment(invoiceId, { kind, method, amount, reference, note });
  } catch (e) {
    redirect(`/admin/facturacion/${invoiceId}?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/facturacion");
  revalidatePath(`/admin/facturacion/${invoiceId}`);
  revalidatePath("/admin/reportes");
  redirect(`/admin/facturacion/${invoiceId}?ok=1`);
}

export async function voidInvoiceAction(invoiceId: string, fd: FormData) {
  try {
    const reason = String(fd.get("reason") ?? "");
    await voidInvoice(invoiceId, reason);
  } catch (e) {
    redirect(`/admin/facturacion/${invoiceId}?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/facturacion");
  revalidatePath(`/admin/facturacion/${invoiceId}`);
  redirect(`/admin/facturacion/${invoiceId}?ok=1`);
}

export async function voidInvoicePaymentAction(invoiceId: string, paymentId: string, fd: FormData) {
  try {
    const reason = String(fd.get("reason") ?? "").trim();
    await voidRecord("payments", paymentId, reason);
  } catch (e) {
    redirect(`/admin/facturacion/${invoiceId}?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/facturacion");
  revalidatePath(`/admin/facturacion/${invoiceId}`);
  revalidatePath("/admin/reportes");
  redirect(`/admin/facturacion/${invoiceId}?ok=1`);
}
