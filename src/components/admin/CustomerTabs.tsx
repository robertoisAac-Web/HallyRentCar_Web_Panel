'use client';

import { useState } from 'react';

interface CustomerTabsProps {
  personalSection: React.ReactNode;
  identificationSection: React.ReactNode;
  riskSection?: React.ReactNode; // Opcional si tienes sección de riesgo/historial
}

export function CustomerTabs({
  personalSection,
  identificationSection,
  riskSection,
}: CustomerTabsProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'identificacion' | 'adicional'>('personal');

  return (
    <div>
      {/* Menú de Pestañas */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'personal'
              ? 'border-emerald-600 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Datos Personales
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('identificacion')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'identificacion'
              ? 'border-emerald-600 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Identificación y Licencia
        </button>

        {riskSection && (
          <button
            type="button"
            onClick={() => setActiveTab('adicional')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'adicional'
                ? 'border-emerald-600 text-emerald-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Historial y Estado
          </button>
        )}
      </div>

      {/* Contenido según la pestaña */}
      <div className="space-y-6">
        {activeTab === 'personal' && <div className="space-y-6">{personalSection}</div>}
        {activeTab === 'identificacion' && <div className="space-y-6">{identificationSection}</div>}
        {activeTab === 'adicional' && riskSection && <div className="space-y-6">{riskSection}</div>}
      </div>
    </div>
  );
}