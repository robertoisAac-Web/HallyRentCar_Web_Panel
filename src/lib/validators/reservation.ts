import { z } from "zod";
import { ValidationError, blank, moneyString, formValue } from "./common";
import { CHANNELS } from "../reservation-rules";

const localDateTime = (label: string) =>
  z.string({ required_error: `${label} es obligatoria` }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `${label} inválida`);

export const reservationSchema = z.object({
  customer_id: z.string({ required_error: "Selecciona un cliente" }).uuid("Selecciona un cliente"),
  vehicle_id: z.string({ required_error: "Selecciona un vehículo" }).uuid("Selecciona un vehículo"),
  channel: z.enum(CHANNELS, { message: "Canal inválido" }),
  pickup_local: localDateTime("La fecha de recogida"),
  return_local: localDateTime("La fecha de devolución"),
  pickup_location: z.preprocess(blank, z.string().trim().optional()),
  return_location: z.preprocess(blank, z.string().trim().optional()),
  discount: z.preprocess(blank, moneyString("El descuento").default("0")),
  extras: z.preprocess(blank, moneyString("Los cargos adicionales").default("0")),
  deposit_required: z.preprocess(blank, moneyString("El depósito").default("0")),
  initial_status: z.preprocess(blank, z.enum(["pending", "confirmed"], { message: "Estado inicial inválido" }).default("pending")),
  internal_notes: z.preprocess(blank, z.string().trim().optional()),
});
export type ReservationInput = z.infer<typeof reservationSchema>;

export function parseReservationForm(fd: FormData): ReservationInput {
  const keys = ["customer_id", "vehicle_id", "channel", "pickup_local", "return_local", "pickup_location",
    "return_location", "discount", "extras", "deposit_required", "initial_status", "internal_notes"];
  const raw = Object.fromEntries(keys.map((k) => [k, formValue(fd, k)]));
  const r = reservationSchema.safeParse(raw);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Datos inválidos");
  return r.data;
}
