"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import { createUser, updateUser, updateMembership, resetPassword, saveRolePermissions } from "@/server/services/users";

async function run(fn: () => Promise<void>, returnToHome = false) {
  try { await fn(); } catch (e) { redirect(`/admin/usuarios?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin", "layout");
  if (returnToHome) {
    redirect("/admin/dashboard?ok=1");
  } else {
    redirect("/admin/usuarios?ok=1");
  }
}
export async function createUserAction(fd: FormData) { await run(() => createUser(fd), fd.get("return_to_home") === "1"); }
export async function updateUserAction(id: string, fd: FormData) { await run(() => updateUser(id, fd), fd.get("return_to_home") === "1"); }
export async function updateMembershipAction(id: string, fd: FormData) { await run(() => updateMembership(id, String(fd.get("role") ?? ""), fd.get("is_active") === "1")); }
export async function resetPasswordAction(id: string, fd: FormData) { await run(() => resetPassword(id, String(fd.get("password") ?? ""))); }
export async function savePermissionsAction(fd: FormData) { await run(() => saveRolePermissions(fd), fd.get("return_to_home") === "1"); }
