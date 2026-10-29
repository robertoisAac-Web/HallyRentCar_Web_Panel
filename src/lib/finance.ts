// Saldos y depósitos. Todo en centavos enteros. Los registros anulados no cuentan.
export interface PaymentLite { kind: "advance" | "payment" | "refund"; amountCents: number; voided: boolean }
export interface ChargeLite { amountCents: number; voided: boolean }
export interface DepositMovementLite { kind: "received" | "returned" | "applied"; amountCents: number; voided: boolean }

export function computeBalance(totalCents: number, charges: ChargeLite[], payments: PaymentLite[]) {
  const chargesTotal = charges.filter((c) => !c.voided).reduce((s, c) => s + c.amountCents, 0);
  const live = payments.filter((p) => !p.voided);
  const received = live.filter((p) => p.kind !== "refund").reduce((s, p) => s + p.amountCents, 0);
  const refunded = live.filter((p) => p.kind === "refund").reduce((s, p) => s + p.amountCents, 0);
  const netReceived = received - refunded;
  const due = totalCents + chargesTotal;
  // balance > 0: el cliente debe; balance < 0: pagó de más (saldo a favor)
  return { chargesTotal, received, refunded, netReceived, due, balance: due - netReceived };
}

export type DepositStatus = "none" | "pending" | "held" | "partially_returned" | "returned" | "applied";

export function depositSummary(requiredCents: number, movements: DepositMovementLite[]) {
  const live = movements.filter((m) => !m.voided);
  const sum = (k: DepositMovementLite["kind"]) => live.filter((m) => m.kind === k).reduce((s, m) => s + m.amountCents, 0);
  const received = sum("received"), returned = sum("returned"), applied = sum("applied");
  const held = received - returned - applied;
  let status: DepositStatus;
  if (received === 0) status = requiredCents > 0 ? "pending" : "none";
  else if (held === received) status = "held";
  else if (held > 0) status = "partially_returned";
  else status = applied > 0 && returned === 0 ? "applied" : "returned";
  return { required: requiredCents, received, returned, applied, held, status };
}

export const DEPOSIT_STATUS_LABEL: Record<DepositStatus, string> = {
  none: "Sin depósito", pending: "Pendiente de recibir", held: "Retenido",
  partially_returned: "Devuelto parcialmente", returned: "Devuelto", applied: "Aplicado a cargos",
};
