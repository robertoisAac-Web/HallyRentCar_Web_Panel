"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-error";
import { updateCompany } from "@/server/services/company";
import {
  updateDgiiSettings,
  createDgiiSequence,
  toggleDgiiSequence,
  type DgiiEnvironment,
  type DgiiSequenceRow,
} from "@/server/services/dgii-ecf";

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

export async function updateDgiiSettingsAction(fd: FormData) {
  try {
    const envRaw = String(fd.get("environment") ?? "TesteCF");
    const environment: DgiiEnvironment =
      envRaw === "CerteCF" || envRaw === "eCF" ? envRaw : "TesteCF";
    const modeRaw = String(fd.get("integration_mode") ?? "direct_dgii");
    const integration_mode = modeRaw === "psfe" ? "psfe" : "direct_dgii";
    const default_tax_rate = Number(fd.get("default_tax_rate") ?? 18);
    const auto_assign_sequence = fd.get("auto_assign_sequence") === "on";

    let p12_file_name: string | null = null;
    let p12_base64: string | null = null;
    const p12File = fd.get("p12_file");
    if (p12File && typeof p12File === "object" && "arrayBuffer" in p12File) {
      const fileObj = p12File as File;
      if (fileObj.size > 0) {
        const buf = Buffer.from(await fileObj.arrayBuffer());
        p12_file_name = fileObj.name || "certificado.p12";
        p12_base64 = buf.toString("base64");
      }
    }

    await updateDgiiSettings({
      environment,
      integration_mode,
      default_tax_rate,
      auto_assign_sequence,
      p12_file_name,
      p12_base64,
      p12_password: String(fd.get("p12_password") ?? ""),
      psfe_provider: String(fd.get("psfe_provider") ?? ""),
      psfe_api_url: String(fd.get("psfe_api_url") ?? ""),
      psfe_api_token: String(fd.get("psfe_api_token") ?? ""),
    });
  } catch (e) {
    redirect(`/admin/configuracion?error=${encodeURIComponent(errorMessage(e))}#dgii`);
  }

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/facturacion");
  redirect("/admin/configuracion?ok=1#dgii");
}

export async function createDgiiSequenceAction(fd: FormData) {
  try {
    const fiscalType = String(fd.get("fiscal_type") ?? "E32") as DgiiSequenceRow["fiscal_type"];
    const startNumber = Number(fd.get("start_number") ?? 1);
    const endNumber = Number(fd.get("end_number") ?? 100);
    const nextNumberRaw = String(fd.get("next_number") ?? "").trim();
    const nextNumber = nextNumberRaw ? Number(nextNumberRaw) : undefined;
    const expirationDate = String(fd.get("expiration_date") ?? "").trim();
    const authorizationNumber = String(fd.get("authorization_number") ?? "").trim();

    await createDgiiSequence({
      fiscal_type: fiscalType,
      start_number: startNumber,
      end_number: endNumber,
      next_number: nextNumber,
      expiration_date: expirationDate,
      authorization_number: authorizationNumber,
    });
  } catch (e) {
    redirect(`/admin/configuracion?error=${encodeURIComponent(errorMessage(e))}#dgii-secuencias`);
  }

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/facturacion");
  redirect("/admin/configuracion?ok=1#dgii-secuencias");
}

export async function toggleDgiiSequenceAction(id: string, isActive: boolean) {
  try {
    await toggleDgiiSequence(id, isActive);
  } catch (e) {
    redirect(`/admin/configuracion?error=${encodeURIComponent(errorMessage(e))}#dgii-secuencias`);
  }

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/facturacion");
  redirect("/admin/configuracion?ok=1#dgii-secuencias");
}
