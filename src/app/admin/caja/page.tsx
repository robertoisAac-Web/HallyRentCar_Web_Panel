import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import {
  getActiveShiftForCurrentUser,
  listCashShifts,
  listBankAccounts,
  listTransferPayments,
} from "@/server/services/cash-and-banks";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { formatBusinessDateTime } from "@/lib/dates";
import { Badge, ErrorBox, OkBox } from "@/components/admin/ui";
import {
  openShiftAction,
  closeShiftAction,
  reconcileTransferAction,
  createBankAccountAction,
  deleteBankAccountAction,
} from "./actions";

export default async function CajaBancosPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    ok?: string;
    reconciled?: "all" | "pending" | "reconciled";
  }>;
}) {
  const ctx = await requirePermission("payments:read");
  const canWrite = ctx.permissions.has("payments:write");
  const { error, ok, reconciled = "all" } = await searchParams;

  const [activeShift, shifts, bankAccounts, transfers] = await Promise.all([
    getActiveShiftForCurrentUser(),
    listCashShifts(),
    listBankAccounts(false),
    listTransferPayments({ reconciled }),
  ]);

  const dop = (cents: number) => formatMoney(cents, "DOP");
  const pendingTransfersCount = transfers.filter((t) => !t.reconciled_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Control de Caja, Turnos y Conciliación Bancaria</h1>
          <p className="mt-1 text-xs text-slate-500">
            Arqueo diario de efectivo por turno, control de gaveta y conciliación de transferencias bancarias con trazabilidad a contratos y facturas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/facturacion" className="btn btn-secondary">
            Ir a Facturación
          </Link>
          <Link href="/admin/reservas" className="btn btn-secondary">
            Ver Contratos / Reservas
          </Link>
        </div>
      </div>

      <ErrorBox error={error} />
      <OkBox ok={ok} error={error} />

      {/* 1. Turno de Caja Actual y Arqueo Diario */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <h2>Turno de Caja Actual (Arqueo Diario)</h2>
              {activeShift ? (
                <Badge tone="green">Turno Abierto · {activeShift.shift.code}</Badge>
              ) : (
                <Badge tone="amber">Sin Turno Abierto</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Todos los cobros en efectivo registrados durante tu sesión se vinculan automáticamente a tu turno activo.
            </p>
          </div>
        </div>

        {activeShift ? (
          <div className="space-y-4">
            <div className="stat-strip">
              <div className="stat">
                <div className="stat-num">{dop(toCents(activeShift.shift.opening_amount_dop))}</div>
                <div className="stat-label">Fondo Inicial en Gaveta (DOP)</div>
              </div>
              <div className="stat">
                <div className="stat-num text-emerald-700">
                  {dop(activeShift.live_cash_in_dop_cents - activeShift.live_cash_out_dop_cents)}
                </div>
                <div className="stat-label">
                  Efectivo Neto Cobrado ({activeShift.payments_count} mov.)
                </div>
              </div>
              <div className="stat">
                <div className="stat-num text-slate-900">{dop(activeShift.live_expected_dop_cents)}</div>
                <div className="stat-label">Efectivo Esperado en Gaveta</div>
              </div>
              <div className="stat">
                <div className="stat-num text-blue-700">
                  {dop(activeShift.transfer_dop_cents + activeShift.card_dop_cents)}
                </div>
                <div className="stat-label">
                  Transferencias ({dop(activeShift.transfer_dop_cents)}) y Tarjetas ({dop(activeShift.card_dop_cents)})
                </div>
              </div>
            </div>

            {(toCents(activeShift.shift.opening_amount_usd) > 0 || activeShift.live_cash_in_usd_cents !== 0) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 flex flex-wrap gap-6">
                <span>
                  <strong>Fondo Inicial USD:</strong> {formatMoney(toCents(activeShift.shift.opening_amount_usd), "USD")}
                </span>
                <span>
                  <strong>Efectivo USD Cobrado:</strong>{" "}
                  {formatMoney(activeShift.live_cash_in_usd_cents - activeShift.live_cash_out_usd_cents, "USD")}
                </span>
                <span>
                  <strong>Efectivo USD Esperado:</strong> {formatMoney(activeShift.live_expected_usd_cents, "USD")}
                </span>
              </div>
            )}

            {canWrite && (
              <form
                action={closeShiftAction.bind(null, activeShift.shift.id)}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Cerrar Turno y Realizar Arqueo Físico ({activeShift.shift.code})
                    </p>
                    <p className="text-xs text-slate-500">
                      Abierto el {formatBusinessDateTime(activeShift.shift.opened_at)} por {activeShift.cashier_name}. Ingresa el efectivo físico contado en gaveta para calcular sobrantes o faltantes.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Efectivo Físico Contado (RD$ DOP) *
                    <input
                      name="counted_cash_dop"
                      required
                      inputMode="decimal"
                      defaultValue={fromCents(activeShift.live_expected_dop_cents)}
                      className="input mt-1 font-semibold"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Efectivo Físico Contado (US$ USD)
                    <input
                      name="counted_cash_usd"
                      inputMode="decimal"
                      defaultValue={fromCents(activeShift.live_expected_usd_cents)}
                      className="input mt-1"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Observaciones del arqueo / entrega
                    <input
                      name="closing_notes"
                      placeholder="Ej: Cuadre conforme, depósito en bóveda"
                      className="input mt-1"
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary">
                    Cerrar Turno y Guardar Arqueo Diario
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          canWrite && (
            <form
              action={openShiftAction}
              className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
            >
              <p className="text-sm font-bold text-slate-900">
                Abrir Nuevo Turno de Caja
              </p>
              <p className="text-xs text-slate-600">
                Inicia tu turno indicando el fondo de efectivo inicial en gaveta (menudo) para registrar los cobros en efectivo del día.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Fondo Inicial en Gaveta (RD$ DOP) *
                  <input
                    name="opening_amount_dop"
                    required
                    inputMode="decimal"
                    defaultValue="0.00"
                    className="input mt-1 font-semibold bg-white"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Fondo Inicial en Gaveta (US$ USD)
                  <input
                    name="opening_amount_usd"
                    inputMode="decimal"
                    defaultValue="0.00"
                    className="input mt-1 bg-white"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Notas de apertura
                  <input
                    name="opening_notes"
                    placeholder="Ej: Turno matutino recepción"
                    className="input mt-1 bg-white"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  Abrir Turno de Caja
                </button>
              </div>
            </form>
          )
        )}
      </section>

      {/* 2. Conciliación de Transferencias Bancarias */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2>Conciliación de Transferencias Bancarias</h2>
              {pendingTransfersCount > 0 && (
                <Badge tone="amber">{pendingTransfersCount} pendientes</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Verifica el banco receptor y el número de referencia/aprobación de cada transferencia contra el estado de cuenta bancario.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <Link
              href="/admin/caja?reconciled=all"
              className={`rounded-lg px-3 py-1.5 font-semibold border ${
                reconciled === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Todas
            </Link>
            <Link
              href="/admin/caja?reconciled=pending"
              className={`rounded-lg px-3 py-1.5 font-semibold border ${
                reconciled === "pending"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Pendientes
            </Link>
            <Link
              href="/admin/caja?reconciled=reconciled"
              className={`rounded-lg px-3 py-1.5 font-semibold border ${
                reconciled === "reconciled"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Conciliadas
            </Link>
          </div>
        </div>

        {transfers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay transferencias bancarias registradas con este filtro.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Recibo #</th>
                  <th>Fecha</th>
                  <th>Cliente / Trazabilidad</th>
                  <th>Banco Receptor</th>
                  <th>Núm. Referencia / Aprobación</th>
                  <th>Importe</th>
                  <th>Estado / Acción</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs font-semibold text-slate-900">
                      {t.receipt_number ?? t.id.slice(0, 8)}
                    </td>
                    <td className="text-xs">{formatBusinessDateTime(t.paid_at)}</td>
                    <td className="text-xs">
                      <div className="font-medium text-slate-800">{t.customer_name}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {t.reservation_id && t.reservation_code && (
                          <Link
                            href={`/admin/reservas/${t.reservation_id}`}
                            className="font-semibold text-slate-900 underline"
                          >
                            {t.reservation_code}
                          </Link>
                        )}
                        {t.invoice_id && t.invoice_code && (
                          <Link
                            href={`/admin/facturacion/${t.invoice_id}`}
                            className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 hover:bg-slate-200"
                          >
                            {t.invoice_code}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="font-semibold text-slate-800">
                      {t.bank_name || "Banco no especificado"}
                    </td>
                    <td className="font-mono text-xs font-semibold text-slate-900">
                      {t.reference || "—"}
                    </td>
                    <td className="font-semibold">
                      {formatMoney(toCents(t.amount), t.currency)}
                    </td>
                    <td>
                      {t.reconciled_at ? (
                        <Badge tone="green">
                          Conciliada ({formatBusinessDateTime(t.reconciled_at)})
                        </Badge>
                      ) : canWrite ? (
                        <form action={reconcileTransferAction.bind(null, t.id)}>
                          <button type="submit" className="btn btn-primary btn-sm">
                            Conciliar en banco
                          </button>
                        </form>
                      ) : (
                        <Badge tone="amber">Pendiente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Catálogo de Cuentas Bancarias Receptoras */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2>Cuentas Bancarias Receptoras</h2>
            <p className="text-xs text-slate-500">
              Bancos disponibles al registrar pagos por transferencia en contratos de alquiler y facturas.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {bankAccounts.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{b.bank_name}</span>
                  <Badge tone={b.is_active ? "green" : "gray"}>{b.currency}</Badge>
                </div>
                <p className="text-slate-600 mt-1">{b.account_label}</p>
                {b.account_number_masked && (
                  <p className="font-mono text-slate-500">Cuenta: {b.account_number_masked}</p>
                )}
              </div>
              {canWrite && (
                <div className="pt-2 border-t border-slate-200/70 flex justify-end">
                  <form action={deleteBankAccountAction.bind(null, b.id)}>
                    <button
                      type="submit"
                      className="text-[11px] font-semibold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                    >
                      Eliminar cuenta
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>

        {canWrite && (
          <details className="rounded-xl border border-slate-200 bg-white p-3.5">
            <summary className="cursor-pointer text-xs font-bold text-slate-800">
              + Agregar nueva cuenta bancaria receptora
            </summary>
            <form
              action={createBankAccountAction}
              className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end"
            >
              <label className="block text-xs font-semibold text-slate-700">
                Banco *
                <input
                  name="bank_name"
                  required
                  placeholder="Ej: Banco Santa Cruz / Scotiabank"
                  className="input mt-1"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Alias / Descripción *
                <input
                  name="account_alias"
                  required
                  placeholder="Ej: Cuenta Operativa Principal"
                  className="input mt-1"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Últimos dígitos (Opcional)
                <input
                  name="account_number_mask"
                  placeholder="Ej: ****4580"
                  className="input mt-1"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Moneda
                <select name="currency" defaultValue="DOP" className="input mt-1">
                  <option value="DOP">DOP (RD$)</option>
                  <option value="USD">USD (US$)</option>
                </select>
              </label>
              <button type="submit" className="btn btn-secondary">
                Guardar Banco
              </button>
            </form>
          </details>
        )}
      </section>

      {/* 4. Historial de Turnos y Arqueos Diarios */}
      <section className="panel space-y-4">
        <div>
          <h2>Historial de Turnos y Arqueos de Caja</h2>
          <p className="text-xs text-slate-500">
            Registro histórico de aperturas, cierres, efectivo esperado vs. contado y diferencias de cuadre.
          </p>
        </div>

        {shifts.length === 0 ? (
          <p className="text-sm text-slate-500">No hay turnos registrados todavía.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Turno #</th>
                  <th>Cajero</th>
                  <th>Apertura / Cierre</th>
                  <th>Fondo Inicial</th>
                  <th>Efectivo Esperado</th>
                  <th>Efectivo Contado</th>
                  <th>Diferencia Arqueo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => {
                  const diffCents = s.shift.difference_dop !== null ? toCents(s.shift.difference_dop) : null;
                  return (
                    <tr key={s.shift.id}>
                      <td className="font-mono text-xs font-bold text-slate-900">{s.shift.code}</td>
                      <td>{s.cashier_name}</td>
                      <td className="text-xs">
                        <div>Abierto: {formatBusinessDateTime(s.shift.opened_at)}</div>
                        {s.shift.closed_at && (
                          <div className="text-slate-500">Cerrado: {formatBusinessDateTime(s.shift.closed_at)}</div>
                        )}
                      </td>
                      <td>{dop(toCents(s.shift.opening_amount_dop))}</td>
                      <td className="font-semibold">{dop(s.live_expected_dop_cents)}</td>
                      <td>
                        {s.shift.counted_cash_dop !== null ? dop(toCents(s.shift.counted_cash_dop)) : "—"}
                      </td>
                      <td>
                        {diffCents === null ? (
                          <span className="text-xs text-slate-400">En curso</span>
                        ) : diffCents === 0 ? (
                          <Badge tone="green">Cuadrado (RD$ 0.00)</Badge>
                        ) : diffCents > 0 ? (
                          <Badge tone="blue">Sobrante +{dop(diffCents)}</Badge>
                        ) : (
                          <Badge tone="red">Faltante {dop(diffCents)}</Badge>
                        )}
                      </td>
                      <td>
                        <Badge tone={s.shift.status === "open" ? "green" : "gray"}>
                          {s.shift.status === "open" ? "Abierto" : "Cerrado"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
