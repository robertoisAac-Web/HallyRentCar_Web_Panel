"use client";

import { useState } from "react";
import { CHANNELS, CHANNEL_LABEL } from "@/lib/reservation-rules";
import { inputCls } from "@/components/admin/ui";
import { CustomerSelector } from "@/components/admin/CustomerSelector";
import { createReservationAction } from "@/app/admin/reservas/actions"; // Asegúrate de que la ruta a tu actions.ts sea correcta

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  daily_rate: number | string;
  currency: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone?: string | null;
  id_number?: string | null;
  risk_flag?: boolean;
  risk_note?: string | null;
}

interface ReservationFormProps {
  sp: { pickup?: string; return?: string; error?: string };
  vehicles: Vehicle[];
  customers: Customer[];
  days: number;
  canConfirm: boolean;
}

export function ReservationFormWithTabs({
  sp,
  vehicles,
  customers,
  days,
  canConfirm,
}: ReservationFormProps) {
  const [activeTab, setActiveTab] = useState<"vehiculo" | "cliente" | "importes">("vehiculo");

  return (
    <form action={createReservationAction} className="space-y-6 max-w-2xl">
      <input type="hidden" name="pickup_local" value={sp.pickup} />
      <input type="hidden" name="return_local" value={sp.return} />

      {/* Navegación por Pestañas */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("vehiculo")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "vehiculo"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            1. Selección de Vehículo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cliente")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "cliente"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            2. Cliente y Origen
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("importes")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "importes"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            3. Importes y Ajustes
          </button>
        </nav>
      </div>

      {/* Pestaña 1: Vehículo (Desplegable) */}
      <div className={activeTab === "vehiculo" ? "block" : "hidden"}>
        <section className="panel space-y-4">
          <h2 className="font-medium text-slate-900">Vehículo disponible para las fechas</h2>
          
          <label className="block text-sm font-medium text-slate-700">
            Seleccionar vehículo *
            <select name="vehicle_id" required className={`${inputCls} mt-1`}>
              <option value="">-- Elige un vehículo --</option>
              {vehicles.map((v) => {
                const daily = Number(v.daily_rate);
                const total = daily * days;
                return (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} {v.year} ({v.plate}) — {v.currency} ${daily.toFixed(2)} / día (Total: ${total.toFixed(2)})
                  </option>
                );
              })}
            </select>
          </label>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => setActiveTab("cliente")}
              className="btn btn-primary"
            >
              Siguiente: Datos del Cliente →
            </button>
          </div>
        </section>
      </div>

      {/* Pestaña 2: Cliente */}
      <div className={activeTab === "cliente" ? "block" : "hidden"}>
        <section className="panel space-y-4">
          <h2 className="font-medium text-slate-900">Información del Cliente y Origen</h2>
          
          <CustomerSelector customers={customers} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <label className="block text-sm font-medium text-slate-700">Canal de origen *
              <select name="channel" required defaultValue="whatsapp" className={inputCls}>
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Lugar de entrega
              <input name="pickup_location" className={inputCls} placeholder="Ej: Aeropuerto" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Lugar de devolución
              <input name="return_location" className={inputCls} placeholder="Ej: Oficina central" />
            </label>
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={() => setActiveTab("vehiculo")}
              className="btn btn-secondary"
            >
              ← Volver a Vehículo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("importes")}
              className="btn btn-primary"
            >
              Siguiente: Importes →
            </button>
          </div>
        </section>
      </div>

      {/* Pestaña 3: Importes y Confirmación */}
      <div className={activeTab === "importes" ? "block" : "hidden"}>
        <section className="panel space-y-4">
          <h2 className="font-medium text-slate-900">Importes y Estado de Reserva</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm font-medium text-slate-700">Descuento
              <input name="discount" inputMode="decimal" placeholder="0" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">Cargos adicionales
              <input name="extras" inputMode="decimal" placeholder="0" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">Depósito en garantía
              <input name="deposit_required" inputMode="decimal" placeholder="0" className={inputCls} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <label className="block text-sm font-medium text-slate-700">Estado inicial
              <select name="initial_status" defaultValue="pending" className={inputCls}>
                <option value="pending">Pendiente (no bloquea el vehículo)</option>
                {canConfirm && <option value="confirmed">Confirmada (bloquea el vehículo)</option>}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Notas internas
              <textarea name="internal_notes" rows={2} className={inputCls} />
            </label>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab("cliente")}
              className="btn btn-secondary"
            >
              ← Volver a Cliente
            </button>
            <button type="submit" className="btn btn-primary">
              Crear reserva
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}