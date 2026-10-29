import { z } from "zod";
import { ValidationError, blank, formValue } from "./common";

export const customerSchema = z.object({
  full_name: z.string({ required_error: "El nombre es obligatorio" }).trim().min(1, "El nombre es obligatorio"),
  phone: z.preprocess(blank, z.string().trim().optional()),
  email: z.preprocess(blank, z.string().trim().email("Correo inválido").optional()),
  country: z.preprocess(blank, z.string().trim().optional()),
  id_type: z.preprocess(blank, z.enum(["cedula", "passport", "other"], { message: "Tipo de identificación inválido" }).optional()),
  id_number: z.preprocess(blank, z.string().trim().optional()),
  license_number: z.preprocess(blank, z.string().trim().optional()),
  license_expires_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de licencia inválida").optional()),
  notes: z.preprocess(blank, z.string().trim().optional()),
  risk_flag: z.preprocess((v) => v === "on", z.boolean()),
  risk_note: z.preprocess(blank, z.string().trim().optional()),
}).refine((d) => (d.id_type === undefined) === (d.id_number === undefined), {
  message: "Indica el tipo y el número de identificación juntos", path: ["id_number"],
});
export type CustomerInput = z.infer<typeof customerSchema>;

export function parseCustomerForm(fd: FormData): CustomerInput {
  const keys = ["full_name", "phone", "email", "country", "id_type", "id_number", "license_number", "license_expires_on", "notes", "risk_note", "risk_flag"];
  const raw = Object.fromEntries(keys.map((k) => [k, formValue(fd, k)]));
  const r = customerSchema.safeParse(raw);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Datos inválidos");
  return r.data;
}
