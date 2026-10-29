"use client";
import { useState } from "react";
import type { UserRow } from "@/server/services/users";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  employee: "Empleado",
  accountant: "Contador",
};

export function EditUserModal({
  user,
  action,
}: {
  user: UserRow & { is_me?: boolean };
  action: (fd: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
        title="Editar usuario"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
        <span>Editar</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-title-${user.membership_id}`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 id={`edit-title-${user.membership_id}`} className="text-base font-semibold text-slate-900">
                  Editar usuario
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Cerrar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <form
              action={async (fd) => {
                await action(fd);
                setOpen(false);
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nombre completo *
                </label>
                <input
                  name="full_name"
                  required
                  defaultValue={user.full_name ?? ""}
                  placeholder="Ej: Juan Pérez"
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Rol en el sistema *
                  </label>
                  <select name="role" defaultValue={user.role} className="input">
                    {Object.entries(ROLE_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Estado de la cuenta
                  </label>
                  <select
                    name="is_active"
                    defaultValue={user.is_active ? "1" : "0"}
                    className="input"
                    disabled={user.is_me}
                  >
                    <option value="1">Activo</option>
                    <option value="0">Inactivo (bloqueado)</option>
                  </select>
                  {user.is_me && (
                    <input type="hidden" name="is_active" value="1" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nueva contraseña <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  placeholder="Dejar en blanco para mantener la actual"
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-400">Si deseas cambiarla, escribe una de al menos 12 caracteres.</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancelar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    name="return_to_home"
                    value="1"
                    className="btn btn-secondary btn-sm"
                  >
                    Guardar e ir a Inicio
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Guardar cambios
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
