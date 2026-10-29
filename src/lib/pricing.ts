// Cálculo de tarifas. Importes en CENTAVOS (enteros) para evitar errores de punto flotante.
// Regla (SUPUESTO S2, pendiente de confirmar): períodos de 24 h desde la recogida,
// con minutos de gracia configurables; mínimo 1 día.
const MIN_PER_DAY = 1440;

export function billableDays(pickup: Date, ret: Date, graceMinutes = 59): number {
  const minutes = (ret.getTime() - pickup.getTime()) / 60000;
  if (!(minutes > 0)) throw new Error("La devolución debe ser posterior a la recogida");
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0) throw new Error("Gracia inválida");
  return Math.max(1, Math.ceil((minutes - graceMinutes) / MIN_PER_DAY));
}

/** Descuento porcentual en basis points (1000 = 10%), redondeo half-up al centavo. */
export function percentOfCents(amountCents: number, basisPoints: number): number {
  if (basisPoints < 0 || basisPoints > 10000) throw new Error("Porcentaje inválido");
  return Math.floor((amountCents * basisPoints + 5000) / 10000);
}

export interface QuoteInput {
  dailyRateCents: number;
  days: number;
  discountCents?: number;
  extrasCents?: number;
}

export function quoteTotalCents(i: QuoteInput): number {
  const { dailyRateCents, days } = i;
  const discount = i.discountCents ?? 0;
  const extras = i.extrasCents ?? 0;
  for (const [k, v] of Object.entries({ dailyRateCents, days, discount, extras })) {
    if (!Number.isInteger(v) || v < 0) throw new Error(`Valor inválido: ${k}`);
  }
  const total = dailyRateCents * days - discount + extras;
  if (total < 0) throw new Error("El descuento no puede superar el subtotal");
  return total;
}
