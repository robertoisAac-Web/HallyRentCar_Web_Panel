import { z } from "zod";

import { ValidationError, blank } from "./common";
export { ValidationError };

export const vehicleSchema = z.object({
  make: z.string({ required_error: "La marca es obligatoria" }).trim().min(1, "La marca es obligatoria"),
  model: z.string({ required_error: "El modelo es obligatorio" }).trim().min(1, "El modelo es obligatorio"),
  year: z.coerce.number({ invalid_type_error: "El año debe ser un número" }).int("El año debe ser entero")
    .min(1980, "Año inválido").max(2100, "Año inválido"),
  plate: z.string({ required_error: "La matrícula es obligatoria" }).trim().min(1, "La matrícula es obligatoria")
    .transform((s) => s.toUpperCase()),
  vin: z.preprocess(blank, z.string().trim().optional()),
  mileage_km: z.preprocess(blank, z.coerce.number().int("El kilometraje debe ser entero").min(0, "El kilometraje no puede ser negativo").default(0)),
  transmission: z.preprocess(blank, z.enum(["automatic", "manual"], { message: "Transmisión inválida" }).optional()),
  fuel_type: z.preprocess(blank, z.string().trim().optional()),
  seats: z.preprocess(blank, z.coerce.number().int().min(1, "Los asientos deben ser al menos 1").max(60).optional()),
  daily_rate: z.string({ required_error: "La tarifa diaria es obligatoria" }).trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Tarifa inválida (ejemplo: 3500 o 3500.00)"),
  currency: z.enum(["DOP", "USD"], { message: "Moneda inválida" }).default("DOP"),
  description: z.preprocess(blank, z.string().trim().optional()),
  features: z.array(z.string().trim().min(1)).default([]),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export function parseVehicleForm(fd: FormData): VehicleInput {
  const raw = {
    make: fd.get("make") ?? undefined, model: fd.get("model") ?? undefined,
    year: fd.get("year") ?? undefined, plate: fd.get("plate") ?? undefined,
    vin: fd.get("vin") ?? undefined, mileage_km: fd.get("mileage_km") ?? undefined,
    transmission: fd.get("transmission") ?? undefined, fuel_type: fd.get("fuel_type") ?? undefined,
    seats: fd.get("seats") ?? undefined, daily_rate: fd.get("daily_rate") ?? undefined,
    currency: fd.get("currency") ?? undefined, description: fd.get("description") ?? undefined,
    features: String(fd.get("features") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
  };
  const r = vehicleSchema.safeParse(raw);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Datos inválidos");
  return r.data;
}
