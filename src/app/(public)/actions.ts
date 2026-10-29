"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicCompany, submitPublicRequest } from "@/server/services/public";
import { errorMessage } from "@/lib/action-error";
import { getPrefs } from "@/server/public-prefs";
import { ValidationError, blank, formValue } from "@/lib/validators/common";

const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas");
const schema = z.object({
  vehicle_id: z.string({ required_error: "Elige un vehículo" }).uuid("Elige un vehículo"),
  pickup_local: local, return_local: local,
  name: z.string({ required_error: "Escribe tu nombre" }).trim().min(2, "Escribe tu nombre completo").max(120),
  phone: z.string({ required_error: "Escribe tu teléfono" }).trim().min(7, "Escribe un teléfono válido").max(30),
  email: z.preprocess(blank, z.string().trim().email("El correo no es válido").optional()),
  pickup_location: z.preprocess(blank, z.string().trim().max(200).optional()),
  return_location: z.preprocess(blank, z.string().trim().max(200).optional()),
  message: z.preprocess(blank, z.string().trim().max(1000, "El mensaje es demasiado largo").optional()),
});

export async function submitRequestAction(fd: FormData) {
  const keys = ["vehicle_id", "pickup_local", "return_local", "name", "phone", "email", "pickup_location", "return_location", "message"];
  const back = `/reservar?vehicle=${encodeURIComponent(formValue(fd, "vehicle_id") ?? "")}&pickup=${encodeURIComponent(formValue(fd, "pickup_local") ?? "")}&return=${encodeURIComponent(formValue(fd, "return_local") ?? "")}`;
  // Campo trampa para robots: si viene lleno, se finge éxito sin crear nada.
  if ((formValue(fd, "website_url") ?? "") !== "") redirect("/reservar/gracias");
  const { lang } = await getPrefs();
  let code: string;
  try {
    const parsed = schema.safeParse(Object.fromEntries(keys.map((k) => [k, formValue(fd, k)])));
    if (!parsed.success) throw new ValidationError(lang === "en" ? "Please check your details and try again." : (parsed.error.issues[0]?.message ?? "Datos inválidos"));
    const company = await getPublicCompany();
    if (!company) throw new ValidationError(lang === "en" ? "Online requests are not available right now." : "Las solicitudes en línea no están disponibles por ahora.");
    code = await submitPublicRequest(company.id, parsed.data, lang);
  } catch (e) { redirect(`${back}&error=${encodeURIComponent(errorMessage(e))}`); }
  const p = formValue(fd, "pickup_local") ?? "", r = formValue(fd, "return_local") ?? "", v = formValue(fd, "vehicle_id") ?? "";
  redirect(`/reservar/gracias?code=${encodeURIComponent(code)}&vehicle=${encodeURIComponent(v)}&pickup=${encodeURIComponent(p)}&return=${encodeURIComponent(r)}`);
}
