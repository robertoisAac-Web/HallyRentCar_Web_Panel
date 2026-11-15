"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { METHOD_LABEL } from "@/lib/validators/finance";
import type { BankAccountRow } from "@/server/services/cash-and-banks";

interface SplitDraft {
  id: string;
  method: "cash" | "transfer" | "card" | "other";
  amount: string;
  bank_account_id: string;
  bank_name: string;
  reference: string;
  note: string;
}

export function MixedPaymentForm({
  action,
  currency,
  balanceCents,
  canVoid,
  bankAccounts,
  activeShiftCode,
}: {
  action: (fd: FormData) => void | Promise<void>;
  currency: "DOP" | "USD";
  balanceCents: number;
  canVoid: boolean;
  bankAccounts: BankAccountRow[];
  activeShiftCode: string | null;
}) {
  const defaultBalanceStr = balanceCents > 0 ? (balanceCents / 100).toFixed(2) : "";
  const [kind, setKind] = useState<"payment" | "advance" | "refund">("payment");
  const [splits, setSplits] = useState<SplitDraft[]>([
    {
      id: "split-1",
      method: "cash",
      amount: defaultBalanceStr,
      bank_account_id: bankAccounts[0]?.id ?? "",
      bank_name: bankAccounts[0]?.bank_name ?? "Banreservas",
      reference: "",
      note: "",
    },
  ]);

  function updateSplit(idx: number, patch: Partial<SplitDraft>) {
    setSplits((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addSplit() {
    const currentSum = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const targetTotal = balanceCents > 0 ? balanceCents / 100 : 0;
    const remaining = Math.max(0, Math.round((targetTotal - currentSum) * 100) / 100);

    setSplits((prev) => [
      ...prev,
      {
        id: `split-${Date.now()}-${prev.length}`,
        method: prev[0]?.method === "cash" ? "transfer" : "cash",
        amount: remaining > 0 ? remaining.toFixed(2) : "",
        bank_account_id: bankAccounts[0]?.id ?? "",
        bank_name: bankAccounts[0]?.bank_name ?? "Banreservas",
        reference: "",
        note: "",
      },
    ]);
  }

  function removeSplit(idx: number) {
    if (splits.length <= 1) return;
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalEntered = useMemo(
    () => splits.reduce((acc, s) => acc + Math.max(0, Number(s.amount) || 0), 0),
    [splits]
  );

  const prefix = currency === "DOP" ? "RD$" : "US$";
  const fmt = (n: number) =>
    `${prefix} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const splitsJson = JSON.stringify(
    splits.map((s) => ({
      method: s.method,
      amount: Number(s.amount || 0).toFixed(2),
      bank_account_id: s.method === "transfer" ? s.bank_account_id : undefined,
      bank_name: s.method === "transfer" ? s.bank_name : undefined,
      reference: s.reference,
      note: s.note,
    }))
  );

  const hasCashSplit = splits.some((s) => s.method === "cash");

  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <input type="hidden" name="splits_json" value={splitsJson} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">
            Registrar Cobro (Pago Simple o Pago Mixto: Efectivo + Transferencia)
          </p>
          <p className="text-xs text-slate-500">
            El efectivo se asigna a la caja del turno activo y las transferencias guardan banco receptor y referencia para conciliación.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "payment" | "advance" | "refund")}
            className="input py-1 text-xs"
            style={{ marginTop: 0, width: "auto" }}
          >
            <option value="payment">Pago / Abono</option>
            <option value="advance">Anticipo</option>
            {canVoid && <option value="refund">Reembolso</option>}
          </select>

          <button
            type="button"
            onClick={addSplit}
            className="btn btn-secondary btn-sm"
            title="Dividir cobro en varios métodos de pago (ej. parte en Efectivo y parte en Transferencia)"
          >
            + Dividir en Pago Mixto
          </button>
        </div>
      </div>

      {/* Estado de Caja para pagos en efectivo */}
      {hasCashSplit && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
            activeShiftCode
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <span>
            {activeShiftCode ? (
              <>
                <strong>Caja del Turno Activa ({activeShiftCode}):</strong> El efectivo entrará automáticamente al arqueo de este turno.
              </>
            ) : (
              <>
                <strong>Aviso de Caja:</strong> No hay un turno de caja abierto en este momento. Puedes abrirlo en Caja y Bancos para el arqueo diario.
              </>
            )}
          </span>
          <Link href="/admin/caja" className="font-bold underline">
            Ir a Caja y Bancos →
          </Link>
        </div>
      )}

      {/* Tramos del pago */}
      <div className="space-y-3">
        {splits.map((s, idx) => (
          <div
            key={s.id}
            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {splits.length > 1 ? `Método de Pago #${idx + 1}` : "Detalle del Pago"}
              </span>
              {splits.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSplit(idx)}
                  className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                >
                  Quitar tramo
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-slate-700">
                Método *
                <select
                  value={s.method}
                  onChange={(e) =>
                    updateSplit(idx, {
                      method: e.target.value as SplitDraft["method"],
                    })
                  }
                  className="input mt-1"
                >
                  {Object.entries(METHOD_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Monto ({prefix}) *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={s.amount}
                  onChange={(e) => updateSplit(idx, { amount: e.target.value })}
                  placeholder="0.00"
                  className="input mt-1"
                />
              </label>

              {s.method === "transfer" ? (
                <>
                  <label className="block text-xs font-semibold text-slate-700">
                    Banco Receptor (Conciliación) *
                    <select
                      value={s.bank_account_id}
                      onChange={(e) => {
                        const acc = bankAccounts.find((b) => b.id === e.target.value);
                        updateSplit(idx, {
                          bank_account_id: e.target.value,
                          bank_name: acc?.bank_name ?? s.bank_name,
                        });
                      }}
                      required
                      className="input mt-1"
                    >
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} ({b.currency})
                        </option>
                      ))}
                      <option value="">Otro Banco</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Núm. Referencia / Aprobación *
                    <input
                      value={s.reference}
                      onChange={(e) => updateSplit(idx, { reference: e.target.value })}
                      required
                      placeholder="Ej: 98451203 (Obligatorio)"
                      className="input mt-1 font-mono"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-slate-700">
                    Referencia {s.method !== "cash" ? "*" : "(opcional)"}
                    <input
                      value={s.reference}
                      onChange={(e) => updateSplit(idx, { reference: e.target.value })}
                      required={s.method !== "cash"}
                      placeholder={s.method === "cash" ? "Recibo en caja" : "Núm. autorización / voucher"}
                      className="input mt-1"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Nota u observación
                    <input
                      value={s.note}
                      onChange={(e) => updateSplit(idx, { note: e.target.value })}
                      placeholder="Ej: Pago en efectivo al entregar"
                      className="input mt-1"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pie con sumatoria en vivo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span>
            Total a registrar ahora:{" "}
            <strong className="text-sm text-emerald-700">{fmt(totalEntered)}</strong>
          </span>
          {balanceCents > 0 && (
            <span className="text-slate-500">
              Saldo restante tras este cobro:{" "}
              <strong className="text-slate-800">
                {fmt(Math.max(0, balanceCents / 100 - totalEntered))}
              </strong>
            </span>
          )}
        </div>

        <button type="submit" className="btn btn-primary">
          {splits.length > 1
            ? `Registrar Pago Mixto (${splits.length} métodos)`
            : "Registrar Pago y Generar Recibo"}
        </button>
      </div>
    </form>
  );
}
