// Uso (una sola vez, desde tu máquina, con las variables del servidor cargadas):
//   COMPANY_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npx tsx --env-file=.env.local scripts/bootstrap-admin.mts
// Se niega a ejecutarse si ya existe alguna empresa. No hay credenciales por defecto.
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, COMPANY_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!url || !key || !COMPANY_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COMPANY_NAME, ADMIN_EMAIL, ADMIN_PASSWORD");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) { console.error("La contraseña debe tener al menos 12 caracteres."); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });
const { count, error: cErr } = await sb.from("companies").select("id", { count: "exact", head: true });
if (cErr) { console.error(cErr.message); process.exit(1); }
if ((count ?? 0) > 0) { console.error("Ya existe una empresa; el bootstrap ya se ejecutó."); process.exit(1); }

const { data: company, error: coErr } = await sb.from("companies").insert({ name: COMPANY_NAME }).select("id").single();
if (coErr) { console.error(coErr.message); process.exit(1); }
const { data: user, error: uErr } = await sb.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true });
if (uErr || !user.user) { console.error(uErr?.message); process.exit(1); }
const { error: mErr } = await sb.from("memberships").insert({ company_id: company.id, user_id: user.user.id, role: "admin" });
if (mErr) { console.error(mErr.message); process.exit(1); }
console.log("Empresa y administrador creados.");
