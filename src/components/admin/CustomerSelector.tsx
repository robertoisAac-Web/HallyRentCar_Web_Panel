'use client';

import { useState } from 'react';

interface CustomerSelectorProps {
  customers: Array<{ 
    id: string; 
    full_name: string; 
    id_number?: string | null; // <-- Permitir null aquí
    phone?: string | null;     // <-- Y aquí por si acaso
  }>;
}

export function CustomerSelector({ customers }: CustomerSelectorProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      {/* Selector de modo */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
          <input
            type="radio"
            name="customer_mode"
            value="existing"
            checked={mode === 'existing'}
            onChange={() => setMode('existing')}
            className="text-emerald-600 focus:ring-emerald-500"
          />
          Cliente existente
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
          <input
            type="radio"
            name="customer_mode"
            value="new"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
            className="text-emerald-600 focus:ring-emerald-500"
          />
          + Crear cliente nuevo
        </label>
      </div>

      {/* Opción A: Cliente existente */}
      {mode === 'existing' ? (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Seleccionar Cliente *
          </label>
          <select name="customer_id" required className="input w-full bg-white">
            <option value="">-- Selecciona un cliente --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} {c.id_number ? `(${c.id_number})` : ''} {c.phone ? `- ${c.phone}` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        /* Opción B: Formulario de Cliente Nuevo */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-md border border-slate-200">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Nombre Completo *
            </label>
            <input
              name="new_customer_full_name"
              required={mode === 'new'}
              placeholder="Ej: Juan Pérez"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Teléfono *
            </label>
            <input
              name="new_customer_phone"
              required={mode === 'new'}
              placeholder="809-000-0000"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Cédula / Pasaporte *
            </label>
            <input
              name="new_customer_id_number"
              required={mode === 'new'}
              placeholder="001-0000000-0"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Licencia de Conducir
            </label>
            <input
              name="new_customer_license_number"
              placeholder="Núm. de licencia"
              className="input w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}