import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeFreeVehicles } from "@/server/availability-core";
import { ValidationError } from "@/lib/validators/common";
import { parseBusinessLocal, isBusinessLocal } from "@/lib/dates";
import type { Lang } from "@/lib/i18n";

// Código de servidor de la web pública. Usa la clave de servicio, así que SOLO devuelve campos pensados para el público.
export interface PublicCompany { id: string; name: string; tagline: string | null; address: string | null; delivery_zones: string | null; terms_text: string | null; phone: string | null; whatsapp_number: string | null; turnaround_minutes: number; grace_minutes: number }
export interface PublicVehicle { id: string; make: string; model: string; year: number; seats: number | null; transmission: string | null; fuel_type: string | null; daily_rate: string; currency: "DOP" | "USD"; features: string[]; description: string | null; photos: string[] }

export async function getPublicCompanyStatus(): Promise<{ company: PublicCompany | null; reason?: string }> {
  const sb = createAdminClient();
  const cols = "id,name,tagline,address,delivery_zones,terms_text,phone,whatsapp_number,turnaround_minutes,grace_minutes,public_enabled";
  const wanted = process.env.PUBLIC_COMPANY_ID;
  const q = wanted
    ? sb.from("companies").select(cols).eq("id", wanted)
    : sb.from("companies").select(cols).eq("public_enabled", true).order("created_at", { ascending: false }).limit(1);
  const { data, error } = await q.maybeSingle();
  let reason: string | undefined;
  if (error) reason = `No se pudo leer la empresa: ${error.message}. Revisa que Docker y Supabase estén encendidos, que hayas corrido "npx supabase migration up" y las claves de .env.local.`;
  else if (!data) reason = wanted ? "PUBLIC_COMPANY_ID no coincide con ninguna empresa. Déjalo vacío en .env.local." : "No hay ninguna empresa creada en la base de datos.";
  else if (!data.public_enabled) reason = 'La web está desactivada: actívala en el panel, Configuración, casilla "Mostrar la web pública".';
  if (reason) { console.error("[web pública]", reason); return { company: null, reason }; }
  const { public_enabled: _omit, ...rest } = data as typeof data & { public_enabled: boolean };
  void _omit;
  return { company: rest as PublicCompany };
}

export async function getPublicCompany(): Promise<PublicCompany | null> {
  return (await getPublicCompanyStatus()).company;
}

export async function getPublicVehicles(companyId: string, onlyIds?: string[]): Promise<PublicVehicle[]> {
  const sb = createAdminClient();
  let q = sb.from("vehicles").select("id,make,model,year,seats,transmission,fuel_type,daily_rate,currency,features,description").eq("company_id", companyId).eq("is_active", true).order("make").order("model");
  if (onlyIds) q = q.in("id", onlyIds.length ? onlyIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  const rows = data ?? [];
  const ids = rows.map((v) => v.id);
  const { data: photos } = ids.length ? await sb.from("vehicle_photos").select("vehicle_id,path,is_primary,created_at").in("vehicle_id", ids).order("is_primary", { ascending: false }).order("created_at") : { data: [] as { vehicle_id: string; path: string }[] };
  return rows.map((v) => ({
    ...v, features: Array.isArray(v.features) ? (v.features as string[]) : [],
    photos: (photos ?? []).filter((p) => p.vehicle_id === v.id).map((p) => sb.storage.from("vehicle-photos").getPublicUrl(p.path).data.publicUrl),
  })) as PublicVehicle[];
}

export async function getFreeVehicleIds(company: PublicCompany, pickupLocal: string, returnLocal: string): Promise<string[] | null> {
  if (!isBusinessLocal(pickupLocal) || !isBusinessLocal(returnLocal)) return null;
  const pickup = parseBusinessLocal(pickupLocal), ret = parseBusinessLocal(returnLocal);
  if (!(ret.getTime() > pickup.getTime())) return null;
  const free = await computeFreeVehicles(createAdminClient(), company.id, pickup, ret, company.turnaround_minutes);
  return free.map((v) => v.id);
}

const ERRORS: Record<Lang, Record<string, string>> = {
  es: {
    PUBLIC_DISABLED: "Las solicitudes en línea no están disponibles por ahora. Escríbenos por WhatsApp.",
    INVALID_NAME: "Escribe tu nombre completo.", INVALID_PHONE: "Escribe un teléfono válido.", INVALID_EMAIL: "El correo no es válido.",
    INVALID_TEXT: "Alguno de los textos es demasiado largo.", INVALID_DATES: "Revisa las fechas: la devolución debe ser posterior a la recogida y la recogida no puede estar en el pasado.",
    RATE_LIMITED: "Has enviado muchas solicitudes. Intenta más tarde o escríbenos por WhatsApp.",
    VEHICLE_UNAVAILABLE: "Ese vehículo ya no está disponible en esas fechas. Elige otro o cambia las fechas.",
  },
  en: {
    PUBLIC_DISABLED: "Online requests are not available right now. Please message us on WhatsApp.",
    INVALID_NAME: "Please enter your full name.", INVALID_PHONE: "Please enter a valid phone number.", INVALID_EMAIL: "The email is not valid.",
    INVALID_TEXT: "One of the texts is too long.", INVALID_DATES: "Check the dates: the return must be after the pick-up and the pick-up cannot be in the past.",
    RATE_LIMITED: "You have sent many requests. Please try later or message us on WhatsApp.",
    VEHICLE_UNAVAILABLE: "That vehicle is no longer available on those dates. Choose another one or change the dates.",
  },
};

export interface PublicRequestInput { vehicle_id: string; pickup_local: string; return_local: string; name: string; phone: string; email?: string; pickup_location?: string; return_location?: string; message?: string }

export async function submitPublicRequest(companyId: string, i: PublicRequestInput, lang: Lang = "es"): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex");
  const { data, error } = await createAdminClient().rpc("create_public_request", {
    p_company: companyId, p_vehicle: i.vehicle_id, p_pickup: parseBusinessLocal(i.pickup_local).toISOString(), p_return: parseBusinessLocal(i.return_local).toISOString(),
    p_name: i.name, p_phone: i.phone, p_email: i.email ?? null, p_pickup_location: i.pickup_location ?? null, p_return_location: i.return_location ?? null,
    p_message: i.message ?? null, p_ip_hash: ipHash,
  });
  if (error) {
    const key = Object.keys(ERRORS[lang]).find((k) => error.message.includes(k));
    if (key) throw new ValidationError(ERRORS[lang][key]);
    console.error("public request error:", error);
    throw new Error("No se pudo enviar la solicitud");
  }
  return data as string;
}

export async function getPublicVehicle(companyId: string, id: string): Promise<PublicVehicle | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return (await getPublicVehicles(companyId, [id]))[0] ?? null;
}
