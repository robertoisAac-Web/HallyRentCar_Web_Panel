'use client';

import { useState } from 'react';

interface UsersTabsProps {
  usersSection: React.ReactNode;
  createUserSection: React.ReactNode;
  permissionsSection: React.ReactNode;
}

export function UsersTabs({
  usersSection,
  createUserSection,
  permissionsSection,
}: UsersTabsProps) {
  const [activeTab, setActiveTab] = useState<'equipo' | 'crear' | 'permisos'>('equipo');

  return (
    <div>
      {/* Menú de Pestañas */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('equipo')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'equipo'
              ? 'border-green-600 text-green-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Equipo Registrado
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('crear')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'crear'
              ? 'border-green-600 text-green-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Agregar Usuario
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('permisos')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'permisos'
              ? 'border-green-600 text-green-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Permisos por Rol
        </button>
      </div>

      {/* Contenido según la pestaña activa */}
      <div className="space-y-6">
        {activeTab === 'equipo' && <div className="space-y-6">{usersSection}</div>}
        {activeTab === 'crear' && <div className="space-y-6">{createUserSection}</div>}
        {activeTab === 'permisos' && <div className="space-y-6">{permissionsSection}</div>}
      </div>
    </div>
  );
}