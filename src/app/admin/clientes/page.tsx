import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import { listCustomers } from "@/server/services/customers";
import { Badge } from "@/components/admin/ui";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requirePermission("customers:read");
  const { q } = await searchParams;
  const customers = await listCustomers(q);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Clientes</h1>
        {ctx.permissions.has("customers:write") && (
          <Link href="/admin/clientes/nuevo" className="btn btn-primary">Nuevo cliente</Link>)}
      </div>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono o documento" className="input max-w-md" />
        <button className="btn btn-secondary">Buscar</button>
      </form>
      {customers.length === 0 ? (
        <p className="empty">
          {q ? "No hay clientes que coincidan con la búsqueda." : "Todavía no hay clientes. Registra el primero con “Nuevo cliente”."}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Documento</th><th>País</th></tr></thead>
            <tbody>{customers.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td><Link href={`/admin/clientes/${c.id}`} className="row-link">{c.full_name}</Link>{c.risk_flag && <> <Badge tone="red">Riesgo</Badge></>}</td>
                <td>{c.phone ?? "—"}</td><td>{c.id_number ?? "—"}</td><td>{c.country ?? "—"}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </div>
  );
}
