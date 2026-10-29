"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseReservationForm } from "@/lib/validators/reservation";
import { createReservation, transitionReservation } from "@/server/services/reservations";
import { errorMessage } from "@/lib/action-error";
import type { ReservationStatus } from "@/lib/reservation-rules";
import { createClient } from "@/lib/supabase/server"; // 👈 La ruta correcta de Supabase en tu proyecto

export async function createReservationAction(fd: FormData) {
  const back = `/admin/reservas/nueva?pickup=${encodeURIComponent(String(fd.get("pickup_local") ?? ""))}&return=${encodeURIComponent(String(fd.get("return_local") ?? ""))}`;
  
  try {
    const customerMode = fd.get("customer_mode") as string;
    let customerId = fd.get("customer_id") as string;

    // Si seleccionó crear un cliente nuevo sobre la marcha
    if (customerMode === "new") {
      const fullName = fd.get("new_customer_full_name") as string;
      const phone = fd.get("new_customer_phone") as string;
      const idNumber = fd.get("new_customer_id_number") as string;
      const licenseNumber = fd.get("new_customer_license_number") as string;

      if (!fullName || !phone) {
        throw new Error("El nombre completo y el teléfono del nuevo cliente son obligatorios.");
      }

      const sb = await createClient();
      const { data: newCustomer, error: customerError } = await sb
        .from("customers")
        .insert({
          full_name: fullName,
          phone: phone,
          id_number: idNumber || null,
          license_number: licenseNumber || null,
        })
        .select("id")
        .single();

      if (customerError) {
        throw new Error(`No se pudo crear el cliente: ${customerError.message}`);
      }

      customerId = newCustomer.id;
    }

    // Inyectamos el ID del cliente (existente o recién creado) al FormData
    fd.set("customer_id", customerId);

    const reservation = await createReservation(parseReservationForm(fd));
    const id = reservation.id;

    revalidatePath("/admin/reservas");
    revalidatePath("/admin/calendario");
    redirect(`/admin/reservas/${id}?ok=1`);

  } catch (e) {
    redirect(`${back}&error=${encodeURIComponent(errorMessage(e))}`);
  }
}

export async function transitionAction(id: string, to: ReservationStatus) {
  try { await transitionReservation(id, to); }
  catch (e) { redirect(`/admin/reservas/${id}?error=${encodeURIComponent(errorMessage(e))}`); }
  revalidatePath("/admin/reservas"); revalidatePath("/admin/calendario"); revalidatePath("/admin/dashboard");
  redirect(`/admin/reservas/${id}?ok=1`);
}