
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

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  let query = supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (process.env.PUBLIC_COMPANY_ID) {
    query = query.eq("company_id", process.env.PUBLIC_COMPANY_ID);
  }

  const { data: membership, error: membershipError } = await query.limit(1).maybeSingle();

  if (membershipError || !membership) return null;

  const { data: perms, error: permissionsError } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("company_id", membership.company_id)
    .eq("role", membership.role);

  if (permissionsError) {
    console.error("Error cargando permisos:", permissionsError.message);
    return null;
  }

  return {
    userId: user.id,
    companyId: membership.company_id,
    role: membership.role,
    permissions: new Set((perms ?? []).map((p) => p.permission)),
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requirePermission(
  permission: Permission
): Promise<AuthContext> {
  const ctx = await requireAuth();

  if (!ctx.permissions.has(permission)) {
    throw new Error("No autorizado");
  }

  return ctx;
}
