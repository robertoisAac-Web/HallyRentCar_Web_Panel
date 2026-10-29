import { requirePermission } from "@/server/auth/permissions";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { ErrorBox } from "@/components/admin/ui";
import { createCustomerAction } from "../actions";

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission("customers:write");
  const { error } = await searchParams;
  return (<div><h1 className="mb-6 page-title">Nuevo cliente</h1><ErrorBox error={error} />
    <CustomerForm action={createCustomerAction} submitLabel="Guardar cliente" /></div>);
}
