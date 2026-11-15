"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import {
  openCashShift,
  closeCashShift,
  reconcileTransferPayment,
  createBankAccount,
} from "@/server/services/cash-and-banks";

export async function openShiftAction(fd: FormData) {
  try {
    await openCashShift({
      opening_amount_dop: String(fd.get("opening_amount_dop") ?? "0"),
      opening_amount_usd: String(fd.get("opening_amount_usd") ?? "0"),
      notes: String(fd.get("opening_notes") ?? ""),
    });
  } catch (e) {
    redirect(`/admin/caja?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/caja");
  redirect("/admin/caja?ok=1");
}

export async function closeShiftAction(shiftId: string, fd: FormData) {
  try {
    await closeCashShift(shiftId, {
      counted_cash_dop: String(fd.get("counted_cash_dop") ?? "0"),
      counted_cash_usd: String(fd.get("counted_cash_usd") ?? "0"),
      closing_notes: String(fd.get("closing_notes") ?? ""),
    });
  } catch (e) {
    redirect(`/admin/caja?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/caja");
  redirect("/admin/caja?ok=1");
}

export async function reconcileTransferAction(paymentId: string) {
  try {
    await reconcileTransferPayment(paymentId);
  } catch (e) {
    redirect(`/admin/caja?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/caja");
  revalidatePath("/admin/facturacion");
  revalidatePath("/admin/reservas");
  redirect("/admin/caja?ok=1");
}

export async function createBankAccountAction(fd: FormData) {
  try {
    const currencyRaw = String(fd.get("currency") ?? "DOP");
    const currency = currencyRaw === "USD" ? "USD" : "DOP";

    await createBankAccount({
      bank_name: String(fd.get("bank_name") ?? ""),
      account_label: String(fd.get("account_alias") ?? ""),
      account_number_masked: String(fd.get("account_number_mask") ?? ""),
      currency,
    });
  } catch (e) {
    redirect(`/admin/caja?error=${encodeURIComponent(errorMessage(e))}`);
  }

  revalidatePath("/admin/caja");
  redirect("/admin/caja?ok=1");
}
