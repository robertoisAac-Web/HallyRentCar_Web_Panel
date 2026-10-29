"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const SECTIONS: { category: string; items: NavItem[] }[] = [
  {
    category: "Principal",
    items: [
      {
        href: "/admin/dashboard",
        label: "Inicio",
        icon: icon(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
      },
      {
        href: "/admin/calendario",
        label: "Calendario",
        icon: icon(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
      },
      {
        href: "/admin/reservas",
        label: "Reservas",
        icon: icon(<><path d="M9 4h6l1 2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3l1-2Z" /><path d="m9 14 2 2 4-4" /></>),
      },
    ],
  },
  {
    category: "Gestión",
    items: [
      {
        href: "/admin/vehiculos",
        label: "Vehículos",
        icon: icon(<><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3zM7 13h.01M17 13h.01" /></>),
      },
      {
        href: "/admin/clientes",
        label: "Clientes",
        icon: icon(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>),
      },
      {
        href: "/admin/gastos",
        label: "Gastos",
        icon: icon(<><path d="M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z" /><path d="M4 7l2-3h12l2 3M9 13h6" /></>),
      },
      {
        href: "/admin/reportes",
        label: "Reportes",
        icon: icon(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
      },
    ],
  },
  {
    category: "Sistema",
    items: [
      {
        href: "/admin/usuarios",
        label: "Usuarios",
        icon: icon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
      },
      {
        href: "/admin/configuracion",
        label: "Configuración",
        icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
      },
    ],
  },
];

export function Sidebar({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menú principal" className="flex flex-col gap-6">
      {SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => allowed.includes(item.href));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.category} className="space-y-1">
            <p className="hidden md:block px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400/80">
              {section.category}
            </p>
            <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {visibleItems.map((i) => {
                const isActive = pathname.startsWith(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={`nav-link ${isActive ? "active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {i.icon}
                    <span className="font-medium">{i.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
