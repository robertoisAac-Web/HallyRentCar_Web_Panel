import { requirePermission } from "@/server/auth/permissions";
import { listUsers, getRolePermissions } from "@/server/services/users";
import { ALL_PERMISSIONS, PERMISSION_LABEL } from "@/lib/permissions-catalog";
import { Badge, ErrorBox, OkBox, PageHeader } from "@/components/admin/ui";
import { EditUserModal } from "@/components/admin/EditUserModal";
import { UsersTabs } from "@/components/admin/UsersTabs";
import {
  createUserAction,
  updateUserAction,
  updateMembershipAction,
  savePermissionsAction,
} from "./actions";

const ROLE_LABEL = {
  admin: "Administrador",
  employee: "Empleado",
  accountant: "Contador",
} as const;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await requirePermission("users:manage");
  const { error, ok } = await searchParams;
  const [users, perms] = await Promise.all([listUsers(), getRolePermissions()]);

  // 1. Sección de Listado de Usuarios
  const usersSection = (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Equipo registrado</h2>
        <span className="text-xs font-medium text-slate-500">
          {users.length} {users.length === 1 ? "usuario" : "usuarios"}
        </span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.user_id === ctx.userId;
              return (
                <tr key={u.membership_id} className={u.is_active ? "" : "opacity-60 bg-slate-50/50"}>
                  <td>
                    <div className="font-semibold text-slate-900">{u.full_name || "Sin nombre asignado"}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>{u.email}</span>
                      {isMe && (
                        <span className="inline-block rounded bg-sky-100 px-1.5 py-0.2 text-[10px] font-semibold text-sky-800">
                          Tú
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge tone={u.role === "admin" ? "violet" : u.role === "accountant" ? "amber" : "blue"}>
                      {ROLE_LABEL[u.role]}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={u.is_active ? "green" : "gray"}>
                      {u.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <EditUserModal
                        user={{ ...u, is_me: isMe }}
                        action={updateUserAction.bind(null, u.membership_id)}
                      />
                      {!isMe && (
                        <form action={updateMembershipAction.bind(null, u.membership_id)}>
                          <input type="hidden" name="role" value={u.role} />
                          <input type="hidden" name="is_active" value={u.is_active ? "0" : "1"} />
                          <button
                            type="submit"
                            className={`btn btn-sm ${
                              u.is_active
                                ? "text-slate-500 hover:text-red-700 hover:bg-red-50 border-transparent"
                                : "btn-secondary"
                            }`}
                            title={u.is_active ? "Desactivar usuario" : "Reactivar usuario"}
                          >
                            {u.is_active ? "Desactivar" : "Reactivar"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  // 2. Sección de Crear Usuario
  const createUserSection = (
    <section className="panel space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Agregar nuevo usuario</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Crea una cuenta para un miembro del equipo. Podrás modificar su rol o nombre más adelante.
        </p>
      </div>
      <form action={createUserAction} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Nombre completo *
            </label>
            <input name="full_name" required placeholder="Ej: Roberto Pichardo" className="input" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Correo electrónico *
            </label>
            <input name="email" type="email" required placeholder="correo@ejemplo.com" className="input" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Contraseña inicial * <span className="font-normal text-slate-400">(mín. 12)</span>
            </label>
            <input name="password" type="password" minLength={12} required placeholder="••••••••••••" className="input" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Rol *
            </label>
            <select name="role" defaultValue="employee" className="input">
              {Object.entries(ROLE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-400">
            Comparte la contraseña temporal por un medio seguro.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              name="return_to_home"
              value="1"
              className="btn btn-secondary"
            >
              Crear y volver a Inicio
            </button>
            <button type="submit" className="btn btn-primary">
              Crear usuario
            </button>
          </div>
        </div>
      </form>
    </section>
  );

  // 3. Sección de Permisos por Rol
  const permissionsSection = (
    <section className="panel space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Permisos por rol</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          El administrador siempre tiene acceso total. Define qué acciones tienen permitidas los empleados y el contador.
        </p>
      </div>
      <form action={savePermissionsAction} className="space-y-4">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Módulo / Permiso</th>
                <th className="text-center w-32">Empleado</th>
                <th className="text-center w-32">Contador</th>
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.filter((p) => p !== "users:manage").map((p) => (
                <tr key={p}>
                  <td className="font-medium text-slate-800">{PERMISSION_LABEL[p]}</td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      name={`perm:employee:${p}`}
                      defaultChecked={perms.employee.has(p)}
                      aria-label={`${PERMISSION_LABEL[p]} para empleado`}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      name={`perm:accountant:${p}`}
                      defaultChecked={perms.accountant.has(p)}
                      aria-label={`${PERMISSION_LABEL[p]} para contador`}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="submit"
            name="return_to_home"
            value="1"
            className="btn btn-secondary"
          >
            Guardar e ir a Inicio
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar permisos
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios y permisos"
        subtitle="Administra los accesos del equipo, asigna roles, nombres, contraseñas y permisos del sistema."
      />
      <ErrorBox error={error} />
      <OkBox ok={ok} error={error} />

      {/* Renderizamos las pestañas */}
      <UsersTabs
        usersSection={usersSection}
        createUserSection={createUserSection}
        permissionsSection={permissionsSection}
      />
    </div>
  );
}