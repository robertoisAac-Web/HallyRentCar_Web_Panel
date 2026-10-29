import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { ALL_PERMISSIONS } from "@/lib/permissions-catalog";

export interface UserRow { membership_id: string; user_id: string; role: "admin" | "employee" | "accountant"; is_active: boolean; full_name: string | null; email: string | null }
const ROLES = ["admin", "employee", "accountant"];

function mapError(e: { code?: string; message: string }): never {
  if (e.code === "23514") throw new ValidationError("Debe quedar al menos un administrador activo");
  console.error("users service error:", e);
  throw new Error("No se pudo completar la operación");
}

export async function listUsers(): Promise<UserRow[]> {
  await requirePermission("users:manage");
  const sb = await createClient();
  const { data, error } = await sb.from("memberships").select("id,user_id,role,is_active").order("created_at");
  if (error) mapError(error);
  const ids = (data ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await sb.from("profiles").select("id,full_name").in("id", ids) : { data: [] as { id: string; full_name: string | null }[] };
  const admin = createAdminClient();
  return Promise.all((data ?? []).map(async (m) => {
    const u = await admin.auth.admin.getUserById(m.user_id);
    return { membership_id: m.id, user_id: m.user_id, role: m.role, is_active: m.is_active,
      full_name: (profiles ?? []).find((p) => p.id === m.user_id)?.full_name ?? null, email: u.data.user?.email ?? null };
  }));
}

export async function createUser(fd: FormData) {
  const ctx = await requirePermission("users:manage");
  const name = String(fd.get("full_name") ?? "").trim(), email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? ""), role = String(fd.get("role") ?? "");
  if (name.length < 2) throw new ValidationError("El nombre es obligatorio");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("Correo inválido");
  if (password.length < 12) throw new ValidationError("La contraseña debe tener al menos 12 caracteres");
  if (!ROLES.includes(role)) throw new ValidationError("Rol inválido");
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !created.user) throw new ValidationError(error?.message.includes("already") ? "Ya existe un usuario con ese correo" : "No se pudo crear el usuario");
  const { error: mErr } = await admin.from("memberships").insert({ company_id: ctx.companyId, user_id: created.user.id, role });
  if (mErr) { await admin.auth.admin.deleteUser(created.user.id); console.error(mErr); throw new Error("No se pudo asignar el rol"); }
}

export async function updateUser(membershipId: string, fd: FormData) {
  await requirePermission("users:manage");
  const role = String(fd.get("role") ?? "");
  const isActive = fd.get("is_active") === "1";
  const fullName = String(fd.get("full_name") ?? "").trim();
  const password = String(fd.get("password") ?? "").trim();

  if (!ROLES.includes(role)) throw new ValidationError("Rol inválido");
  if (fullName.length < 2) throw new ValidationError("El nombre debe tener al menos 2 caracteres");
  if (password && password.length < 12) throw new ValidationError("La contraseña debe tener al menos 12 caracteres");

  const sb = await createClient();
  const { data: member, error: mFindErr } = await sb.from("memberships").select("id, user_id, role, is_active").eq("id", membershipId).maybeSingle();
  if (mFindErr || !member) throw new ValidationError("Usuario no encontrado");

  const { error: mErr } = await sb.from("memberships").update({ role, is_active: isActive }).eq("id", membershipId);
  if (mErr) mapError(mErr);

  const { error: pErr } = await sb.from("profiles").update({ full_name: fullName }).eq("id", member.user_id);
  if (pErr) console.error("Error actualizando perfil:", pErr);

  const authUpdate: { user_metadata: { full_name: string }; password?: string } = {
    user_metadata: { full_name: fullName },
  };
  if (password) authUpdate.password = password;

  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.updateUserById(member.user_id, authUpdate);
  if (authErr) {
    console.error("Error actualizando auth:", authErr);
    throw new Error("No se pudo actualizar el usuario en autenticación");
  }
}

export async function updateMembership(id: string, role: string, isActive: boolean) {
  await requirePermission("users:manage");
  if (!ROLES.includes(role)) throw new ValidationError("Rol inválido");
  const sb = await createClient();
  const { data, error } = await sb.from("memberships").update({ role, is_active: isActive }).eq("id", id).select("id");
  if (error) mapError(error);
  if (!data || data.length === 0) throw new ValidationError("Usuario no encontrado");
}

export async function resetPassword(membershipId: string, password: string) {
  await requirePermission("users:manage");
  if (password.length < 12) throw new ValidationError("La contraseña debe tener al menos 12 caracteres");
  const sb = await createClient();
  const { data } = await sb.from("memberships").select("user_id").eq("id", membershipId).maybeSingle();
  if (!data) throw new ValidationError("Usuario no encontrado");
  const { error } = await createAdminClient().auth.admin.updateUserById(data.user_id, { password });
  if (error) { console.error(error); throw new Error("No se pudo cambiar la contraseña"); }
}

export async function getRolePermissions(): Promise<Record<string, Set<string>>> {
  const ctx = await requirePermission("users:manage");
  const sb = await createClient();
  const { data } = await sb.from("role_permissions").select("role,permission").eq("company_id", ctx.companyId);
  const out: Record<string, Set<string>> = { admin: new Set(), employee: new Set(), accountant: new Set() };
  for (const r of data ?? []) out[r.role]?.add(r.permission);
  return out;
}

/** Guarda los permisos de empleado y contador. El administrador siempre conserva todos. */
export async function saveRolePermissions(fd: FormData) {
  const ctx = await requirePermission("users:manage");
  const sb = await createClient();
  const current = await getRolePermissions();
  for (const role of ["employee", "accountant"] as const) {
    const wanted = new Set(ALL_PERMISSIONS.filter((p) => p !== "users:manage" && fd.get(`perm:${role}:${p}`) === "on"));
    const toDelete = [...current[role]].filter((p) => !wanted.has(p));
    const toAdd = [...wanted].filter((p) => !current[role].has(p));
    if (toDelete.length) { const { error } = await sb.from("role_permissions").delete().eq("company_id", ctx.companyId).eq("role", role).in("permission", toDelete); if (error) mapError(error); }
    if (toAdd.length) { const { error } = await sb.from("role_permissions").insert(toAdd.map((permission) => ({ company_id: ctx.companyId, role, permission }))); if (error) mapError(error); }
  }
}
