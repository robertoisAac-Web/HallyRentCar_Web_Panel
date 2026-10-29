'use client';

import { useState } from 'react';

interface VehicleTabsProps {
  vehicleId: string;
  vehicle: any;
  photosSection: React.ReactNode;
  vehicleForm: React.ReactNode;
  documentsSection: React.ReactNode;
  blocksSection: React.ReactNode;
  deactivateSection: React.ReactNode;
}

export function VehicleTabs({
  photosSection,
  vehicleForm,
  documentsSection,
  blocksSection,
  deactivateSection,
}: VehicleTabsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'fotos' | 'documentos' | 'operaciones'>('general');

  return (
    <div>
      {/* Menú de Pestañas (Tabs) */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-green-600 text-green-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Información y Formulario
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fotos')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'fotos'
              ? 'border-green-600 text-green-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Fotografías
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documentos')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'documentos'
              ? 'border-green-600 text-green-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Documentos y Seguros
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operaciones')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'operaciones'
              ? 'border-green-600 text-green-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Mantenimiento y Estado
        </button>
      </div>

      {/* Contenido según la pestaña activa */}
      <div className="space-y-6">
        {activeTab === 'general' && <div className="space-y-6">{vehicleForm}</div>}
        {activeTab === 'fotos' && <div className="space-y-6">{photosSection}</div>}
        {activeTab === 'documentos' && <div className="space-y-6">{documentsSection}</div>}
        {activeTab === 'operaciones' && (
          <div className="space-y-6">
            {blocksSection}
            {deactivateSection}
          </div>
        )}  
      </div>
    </div>
  );
}