import Link from "next/link";
import { requireAuth } from "@/server/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/Sidebar";
import { signOutAction } from "./actions";

const NAV_PERMISSION: Record<string, string> = {
  "/admin/dashboard": "reservations:read",
  "/admin/reservas": "reservations:read",
  "/admin/calendario": "reservations:read",
  "/admin/vehiculos": "vehicles:read",
  "/admin/clientes": "customers:read",
  "/admin/gastos": "expenses:read",
  "/admin/reportes": "reports:read",
  "/admin/usuarios": "users:manage",
  "/admin/configuracion": "company:manage",
};

const ROLE_LABEL = {
  admin: "Administrador",
  employee: "Empleado",
  accountant: "Contador",
} as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  const sb = await createClient();
  const { data: company } = await sb.from("companies").select("name").eq("id", ctx.companyId).maybeSingle();

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-[#f8fafc] text-slate-800 antialiased">
      <aside className="flex flex-col gap-4 bg-[#0a1926] p-4 text-white md:sticky md:top-0 md:h-screen md:w-64 md:gap-6 md:p-5 border-r border-slate-800/80 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 md:block">
          <div>
            <Link href="/admin/dashboard" className="block hover:opacity-90 transition-opacity">
              <img src="/logo.png" alt={company?.name ?? "HallyRentCar"} className="h-8 w-auto" />
            </Link>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#76e012] shadow-[0_0_6px_#76e012]"></span>
              <p className="text-[11px] text-slate-400 font-medium">Panel Administrativo</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <Sidebar allowed={Object.entries(NAV_PERMISSION).filter(([, p]) => ctx.permissions.has(p)).map(([h]) => h)} />
        </div>

        <div className="mt-auto hidden border-t border-white/10 pt-4 text-xs md:block">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Rol activo</span>
            <span className="font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded text-[11px]">
              {ROLE_LABEL[ctx.role]}
            </span>
          </div>
          <form action={signOutAction}>
            <button className="w-full text-left py-1 text-slate-400 hover:text-white transition-colors flex items-center justify-between">
              <span>Cerrar sesión</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 md:p-10 lg:p-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
