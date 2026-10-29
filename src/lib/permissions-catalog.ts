export const PERMISSION_LABEL: Record<string, string> = {
  "vehicles:read": "Ver vehículos", "vehicles:write": "Crear y editar vehículos",
  "customers:read": "Ver clientes", "customers:write": "Crear y editar clientes",
  "reservations:read": "Ver reservas y calendario", "reservations:write": "Crear y editar reservas, cancelar",
  "reservations:confirm": "Confirmar o rechazar reservas", "availability:write": "Bloqueos de mantenimiento",
  "payments:read": "Ver pagos y depósitos", "payments:write": "Registrar pagos y depósitos",
  "payments:void": "Reembolsar, anular y aplicar deducciones", "checklists:write": "Registrar entregas y devoluciones",
  "expenses:read": "Ver gastos", "expenses:write": "Registrar y anular gastos", "reports:read": "Ver reportes",
  "audit:read": "Ver auditoría", "users:manage": "Administrar usuarios y permisos", "company:manage": "Configurar la empresa",
};
export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL);
