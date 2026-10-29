"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import { updateCompany } from "@/server/services/company";

export async function updateCompanyAction(fd: FormData) {
  const returnToHome = fd.get("return_to_home") === "1";
  try {
    await updateCompany(fd);
  } catch (e) {
    redirect(`/admin/configuracion?error=${encodeURIComponent(errorMessage(e))}`);
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  if (returnToHome) {
    redirect("/admin/dashboard?ok=1");
  } else {
    redirect("/admin/configuracion?ok=1");
  }
}
