import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Permission =
  | "vehicles:read" | "vehicles:write" | "customers:read" | "customers:write"
  | "reservations:read" | "reservations:write" | "reservations:confirm"
  | "availability:write" | "users:manage" | "company:manage" | "audit:read"
  | "payments:read" | "payments:write" | "payments:void"
  | "expenses:read" | "expenses:write" | "checklists:write" | "reports:read";

export interface AuthContext {
  userId: string;
  companyId: string;
  role: "admin" | "employee" | "accountant";
  permissions: Set<string>;
}

/** Contexto del usuario autenticado (MVP: una empresa por usuario; la primera membresía activa). */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase
    .from("memberships").select("company_id, role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!m) return null;
  const { data: perms } = await supabase
    .from("role_permissions").select("permission")
    .eq("company_id", m.company_id).eq("role", m.role);
  return {
    userId: user.id, companyId: m.company_id, role: m.role,
    permissions: new Set((perms ?? []).map((p) => p.permission)),
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.permissions.has(permission)) throw new Error("No autorizado");
  return ctx;
}
