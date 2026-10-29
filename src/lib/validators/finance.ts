import { z } from "zod";
import { ValidationError, blank, moneyString, formValue } from "./common";

const positiveMoney = (label: string) =>
  moneyString(label).refine((v) => Number(v) > 0, `${label} debe ser mayor que cero`);
const METHODS = ["cash", "transfer", "card", "other"] as const;
export const METHOD_LABEL: Record<(typeof METHODS)[number], string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };
export const EXPENSE_CATEGORIES = ["maintenance", "repair", "wash", "fuel", "insurance", "taxes", "commission", "other"] as const;
export const CATEGORY_LABEL: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  maintenance: "Mantenimiento", repair: "Reparaciones", wash: "Lavado", fuel: "Combustible operativo",
  insurance: "Seguros", taxes: "Impuestos y tasas", commission: "Comisiones", other: "Otros",
};
export const FUEL_LEVELS = ["empty", "quarter", "half", "three_quarters", "full"] as const;
export const FUEL_LABEL: Record<(typeof FUEL_LEVELS)[number], string> = { empty: "Vacío", quarter: "1/4", half: "1/2", three_quarters: "3/4", full: "Lleno" };

function parse<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.infer<S> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Datos inválidos");
  return r.data;
}
const pick = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, formValue(fd, k)]));
const optText = z.preprocess(blank, z.string().trim().optional());

const methodField = z.enum(METHODS, { message: "Método de pago inválido" });
const refined = <T extends { method?: string; reference?: string }>(d: T) => d.method === "cash" || !!d.reference;
const refMsg = { message: "La referencia es obligatoria si no es efectivo", path: ["reference"] };

const paymentSchema = z.object({
  kind: z.enum(["advance", "payment", "refund"], { message: "Tipo de pago inválido" }),
  method: methodField, amount: positiveMoney("El importe"), reference: optText, note: optText,
}).refine(refined, refMsg);
export type PaymentInput = z.infer<typeof paymentSchema>;
export const parsePaymentForm = (fd: FormData) => parse(paymentSchema, pick(fd, ["kind", "method", "amount", "reference", "note"]));

const chargeSchema = z.object({
  description: z.string({ required_error: "La descripción es obligatoria" }).trim().min(1, "La descripción es obligatoria"),
  amount: positiveMoney("El importe"),
});
export const parseChargeForm = (fd: FormData) => parse(chargeSchema, pick(fd, ["description", "amount"]));

const depositSchema = z.object({
  kind: z.enum(["received", "returned", "applied"], { message: "Tipo de movimiento inválido" }),
  method: z.preprocess(blank, methodField.optional()), amount: positiveMoney("El importe"), reference: optText, note: optText,
}).refine((d) => d.kind === "applied" || !!d.method, { message: "Indica el método", path: ["method"] })
  .refine((d) => d.kind === "applied" || d.method === "cash" || !!d.reference, refMsg)
  .refine((d) => d.kind !== "applied" || !!d.note, { message: "Una deducción debe tener una justificación", path: ["note"] });
export type DepositInput = z.infer<typeof depositSchema>;
export const parseDepositForm = (fd: FormData) => parse(depositSchema, pick(fd, ["kind", "method", "amount", "reference", "note"]));

const voidSchema = z.object({ reason: z.string({ required_error: "Indica el motivo" }).trim().min(3, "Indica el motivo (mínimo 3 caracteres)") });
export const parseVoidForm = (fd: FormData) => parse(voidSchema, pick(fd, ["reason"])).reason;

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, { message: "Categoría inválida" }),
  amount: positiveMoney("El importe"),
  currency: z.preprocess(blank, z.enum(["DOP", "USD"], { message: "Moneda inválida" }).default("DOP")),
  expense_date: z.string({ required_error: "La fecha es obligatoria" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  vehicle_id: z.preprocess(blank, z.string().uuid("Vehículo inválido").optional()),
  vendor: optText, description: optText,
});
export type ExpenseInput = z.infer<typeof expenseSchema>;
export const parseExpenseForm = (fd: FormData) => parse(expenseSchema, pick(fd, ["category", "amount", "currency", "expense_date", "vehicle_id", "vendor", "description"]));

const checklistSchema = z.object({
  odometer_km: z.coerce.number({ invalid_type_error: "El kilometraje debe ser un número" }).int("El kilometraje debe ser entero").min(0, "Kilometraje inválido"),
  fuel_level: z.enum(FUEL_LEVELS, { message: "Indica el nivel de combustible" }),
  condition_notes: optText, damages: optText, accessories: optText, observations: optText,
});
export type ChecklistInput = z.infer<typeof checklistSchema>;
export const parseChecklistForm = (fd: FormData) =>
  parse(checklistSchema, pick(fd, ["odometer_km", "fuel_level", "condition_notes", "damages", "accessories", "observations"]));
