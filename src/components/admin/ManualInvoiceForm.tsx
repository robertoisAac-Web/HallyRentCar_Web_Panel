"use client";

import { useState, useMemo } from "react";
import { FISCAL_TYPE_LABEL, type FiscalType } from "@/server/services/invoices";
import { METHOD_LABEL } from "@/lib/validators/finance";

export interface CustomerOption {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
}

export interface VehicleOption {
  id: string;
  label: string;
  daily_rate: string;
  currency: "DOP" | "USD";
}

interface LineItemDraft {
  id: string;
  item_type: "rental" | "extra" | "service" | "other";
  description: string;
  quantity: number;
  unit_price: string;
}

export function ManualInvoiceForm({
  action,
  customers,
  vehicles,
  defaultIssueDate,
  defaultDueDate,
}: {
  action: (fd: FormData) => void | Promise<void>;
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  defaultIssueDate: string;
  defaultDueDate: string;
}) {
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    customers.length > 0 ? "existing" : "new"
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerTaxName, setCustomerTaxName] = useState<string>("");
  const [customerTaxId, setCustomerTaxId] = useState<string>("");

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [currency, setCurrency] = useState<"DOP" | "USD">("DOP");
  const [discountAmount, setDiscountAmount] = useState<string>("0");
  const [taxRate, setTaxRate] = useState<number>(0);
  const [fiscalType, setFiscalType] = useState<FiscalType>("none");
  const [ncfOrEcf, setNcfOrEcf] = useState<string>("");

  const [paymentMode, setPaymentMode] = useState<"none" | "full" | "partial">("none");
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  const [items, setItems] = useState<LineItemDraft[]>([
    {
      id: "line-1",
      item_type: "rental",
      description: "Alquiler de vehículo",
      quantity: 1,
      unit_price: "3500.00",
    },
  ]);

  function handleCustomerSelect(id: string) {
    setSelectedCustomerId(id);
    const found = customers.find((c) => c.id === id);
    if (found) {
      setCustomerTaxName(found.full_name);
      setCustomerTaxId(found.id_number ?? "");
    }
  }

  function handleVehicleSelect(vId: string) {
    setSelectedVehicleId(vId);
    const v = vehicles.find((x) => x.id === vId);
    if (v) {
      setCurrency(v.currency);
      setItems((prev) => {
        if (prev.length === 0) return prev;
        const first = prev[0];
        if (first.item_type === "rental") {
          return [
            {
              ...first,
              description: `Alquiler de vehículo: ${v.label}`,
              unit_price: Number(v.daily_rate).toFixed(2),
            },
            ...prev.slice(1),
          ];
        }
        return prev;
      });
    }
  }

  function updateItem(index: number, patch: Partial<LineItemDraft>) {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, ...patch } : it)));
  }

  function addItem(type: LineItemDraft["item_type"] = "extra") {
    const defaultDesc =
      type === "rental"
        ? "Días adicionales de alquiler"
        : type === "extra"
          ? "Cargo adicional (Ej: entrega, combustible, limpieza)"
          : type === "service"
            ? "Seguro / Cobertura adicional"
            : "Otro concepto";
    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length}`,
        item_type: type,
        description: defaultDesc,
        quantity: 1,
        unit_price: "0.00",
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const calc = useMemo(() => {
    const subtotal = items.reduce((acc, it) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const p = Math.max(0, Number(it.unit_price) || 0);
      return acc + Math.round(q * p * 100) / 100;
    }, 0);
    const discount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * (Math.max(0, taxRate) / 100) * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;

    let initialPay = 0;
    if (paymentMode === "full") {
      initialPay = total;
    } else if (paymentMode === "partial") {
      initialPay = Math.min(total, Math.max(0, Number(partialAmount) || 0));
    }
    const balance = Math.max(0, Math.round((total - initialPay) * 100) / 100);
    return { subtotal, discount, taxable, tax, total, initialPay, balance };
  }, [items, discountAmount, taxRate, paymentMode, partialAmount]);

  const prefix = currency === "DOP" ? "RD$" : "US$";
  const fmt = (n: number) =>
    `${prefix} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemsPayload = JSON.stringify(
    items.map((i) => ({
      item_type: i.item_type,
      description: i.description,
      quantity: Number(i.quantity) || 1,
      unit_price: String(Number(i.unit_price || 0).toFixed(2)),
    }))
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="items_json" value={itemsPayload} />
      <input
        type="hidden"
        name="initial_payment_amount"
        value={paymentMode === "none" ? "" : calc.initialPay.toFixed(2)}
      />

      {/* 1. Cliente y Vehículo */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2>1. Datos del Cliente y Vehículo</h2>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCustomerMode("existing")}
              className={`chip cursor-pointer ${customerMode === "existing" ? "chip-active" : ""}`}
            >
              Cliente registrado
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode("new");
                setSelectedCustomerId("");
              }}
              className={`chip cursor-pointer ${customerMode === "new" ? "chip-active" : ""}`}
            >
              + Nuevo cliente
            </button>
          </div>
        </div>

        {customerMode === "existing" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              Seleccionar cliente *
              <select
                name="customer_id"
                required={customerMode === "existing"}
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="input"
              >
                <option value="">— Selecciona un cliente —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.id_number ? `· ${c.id_number}` : ""} {c.phone ? `· ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              Vehículo asociado (opcional)
              <select
                name="vehicle_id"
                value={selectedVehicleId}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                className="input"
              >
                <option value="">— Sin vehículo específico / Libre —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} · {v.currency === "DOP" ? "RD$" : "US$"} {v.daily_rate}/día
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <input type="hidden" name="customer_id" value="" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block sm:col-span-2">
                Nombre completo o Razón Social *
                <input
                  name="new_customer_name"
                  required={customerMode === "new"}
                  placeholder="Ej: Juan Pérez / Empresa SRL"
                  onChange={(e) => setCustomerTaxName(e.target.value)}
                  className="input"
                />
              </label>
              <label className="block">
                Tipo Doc.
                <select name="new_customer_doc_type" className="input">
                  <option value="cedula">Cédula / RNC</option>
                  <option value="passport">Pasaporte</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="block">
                Número Cédula / RNC
                <input
                  name="new_customer_doc_number"
                  placeholder="001-0000000-0"
                  onChange={(e) => setCustomerTaxId(e.target.value)}
                  className="input"
                />
              </label>
              <label className="block">
                Teléfono / WhatsApp
                <input name="new_customer_phone" placeholder="+1 809-000-0000" className="input" />
              </label>
              <label className="block">
                Correo electrónico
                <input name="new_customer_email" type="email" placeholder="cliente@correo.com" className="input" />
              </label>
              <label className="block sm:col-span-2">
                Vehículo asociado (opcional)
                <select
                  name="vehicle_id"
                  value={selectedVehicleId}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                  className="input"
                >
                  <option value="">— Sin vehículo específico / Libre —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} · {v.currency === "DOP" ? "RD$" : "US$"} {v.daily_rate}/día
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            Fecha de emisión *
            <input type="date" name="issue_date" defaultValue={defaultIssueDate} required className="input" />
          </label>
          <label className="block">
            Fecha de vencimiento *
            <input type="date" name="due_date" defaultValue={defaultDueDate} required className="input" />
          </label>
          <label className="block">
            Moneda *
            <select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "DOP" | "USD")}
              className="input"
            >
              <option value="DOP">Pesos Dominicanos (RD$ / DOP)</option>
              <option value="USD">Dólares Estadounidenses (US$ / USD)</option>
            </select>
          </label>
        </div>
      </section>

      {/* 2. Renglones de facturación (Cálculo automático de días, tarifa, extras) */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2>2. Conceptos, Alquiler por Días y Cargos</h2>
            <p className="text-xs text-slate-500">
              El sistema multiplica automáticamente los días o unidades por la tarifa diaria o precio unitario.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addItem("rental")} className="btn btn-secondary btn-sm">
              + Línea de Alquiler
            </button>
            <button type="button" onClick={() => addItem("extra")} className="btn btn-secondary btn-sm">
              + Cargo / Extra
            </button>
            <button type="button" onClick={() => addItem("service")} className="btn btn-secondary btn-sm">
              + Seguro / Servicio
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const lineSubtotal = (Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0));
            return (
              <div
                key={item.id}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-12 sm:items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Tipo
                    <select
                      value={item.item_type}
                      onChange={(e) =>
                        updateItem(idx, {
                          item_type: e.target.value as LineItemDraft["item_type"],
                        })
                      }
                      className="input mt-1"
                    >
                      <option value="rental">Alquiler (Días)</option>
                      <option value="extra">Cargo / Extra</option>
                      <option value="service">Seguro / Servicio</option>
                      <option value="other">Otro</option>
                    </select>
                  </label>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-600">
                    Descripción del concepto *
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      required
                      placeholder="Ej: Alquiler Honda CR-V EX 2025 · 4 días"
                      className="input mt-1"
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    {item.item_type === "rental" ? "Días *" : "Cantidad *"}
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      required
                      className="input mt-1"
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    {item.item_type === "rental" ? "Tarifa / Día *" : "Precio Unit. *"}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: e.target.value })}
                      required
                      className="input mt-1"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between sm:col-span-1 sm:justify-end gap-2 pb-1">
                  <span className="text-xs font-bold text-slate-800 sm:hidden">{fmt(lineSubtotal)}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      title="Eliminar línea"
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Descuento, Impuestos y Resumen Automático */}
        <div className="grid gap-6 border-t border-slate-200 pt-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">
                Descuento ({prefix})
                <input
                  type="number"
                  name="discount_amount"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="input mt-1"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Impuesto / ITBIS (%)
                <select
                  name="tax_rate"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="input mt-1"
                >
                  <option value={0}>0% · Sin ITBIS / Exento</option>
                  <option value={18}>18% · ITBIS República Dominicana</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Notas o condiciones en la factura (opcional)
              <textarea
                name="notes"
                rows={2}
                placeholder="Ej: Incluye seguro básico. Combustible debe entregarse al mismo nivel."
                className="input mt-1"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal alquiler y conceptos</span>
              <span className="font-semibold text-slate-900">{fmt(calc.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Descuento aplicado</span>
              <span className="font-medium text-emerald-700">- {fmt(calc.discount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Impuestos ({taxRate}% ITBIS)</span>
              <span className="font-medium text-slate-800">+ {fmt(calc.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total a Facturar</span>
              <span>{fmt(calc.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Preparación Fiscal DGII (República Dominicana) */}
      <section className="panel space-y-4">
        <div>
          <h2>3. Configuración Fiscal DGII (NCF / e-CF · República Dominicana)</h2>
          <p className="text-xs text-slate-500">
            El sistema no genera números fiscales ficticios. Si dejas el NCF/e-CF en blanco, el documento se emitirá como{" "}
            <strong>Factura Interna</strong>.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            Tipo de documento / Comprobante
            <select
              name="fiscal_type"
              value={fiscalType}
              onChange={(e) => setFiscalType(e.target.value as FiscalType)}
              className="input"
            >
              {Object.entries(FISCAL_TYPE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            RNC / Cédula en Factura
            <input
              name="customer_tax_id"
              value={customerTaxId}
              onChange={(e) => setCustomerTaxId(e.target.value)}
              placeholder="Ej: 131-00000-1 o Cédula"
              className="input"
            />
          </label>

          <label className="block">
            Nombre / Razón Social Fiscal
            <input
              name="customer_tax_name"
              value={customerTaxName}
              onChange={(e) => setCustomerTaxName(e.target.value)}
              placeholder="Nombre en el comprobante"
              className="input"
            />
          </label>
        </div>

        {fiscalType !== "none" && (
          <div className="grid gap-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-700">
              NCF o e-CF Autorizado (Opcional)
              <input
                name="ncf_or_ecf"
                value={ncfOrEcf}
                onChange={(e) => setNcfOrEcf(e.target.value.toUpperCase())}
                placeholder={fiscalType.startsWith("E") ? "Ej: E310000000001 (solo si autorizado)" : "Ej: B0100000001 (solo si autorizado)"}
                className="input mt-1 font-mono"
              />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">
                Déjalo vacío si aún no tienes secuencia DGII activa; se guardará como Factura Interna preparada para {fiscalType}.
              </span>
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Vencimiento secuencia NCF (Opcional)
              <input type="date" name="ncf_expiration_date" className="input mt-1" />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Código Seguridad e-CF (Solo Serie E)
              <input
                name="security_code"
                maxLength={6}
                placeholder="6 caracteres (si aplica)"
                className="input mt-1 font-mono"
              />
            </label>
          </div>
        )}
      </section>

      {/* 4. Registro de Pago Inicial (Opcional) */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2>4. Pago al Emitir Factura (Opcional)</h2>
            <p className="text-xs text-slate-500">
              Puedes dejarla pendiente de cobro, registrar el pago total o registrar un abono parcial ahora mismo (generará su Recibo de Pago automáticamente).
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPaymentMode("none")}
              className={`chip cursor-pointer ${paymentMode === "none" ? "chip-active" : ""}`}
            >
              Dejar pendiente
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("full")}
              className={`chip cursor-pointer ${paymentMode === "full" ? "chip-active" : ""}`}
            >
              Pago completo ({fmt(calc.total)})
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("partial")}
              className={`chip cursor-pointer ${paymentMode === "partial" ? "chip-active" : ""}`}
            >
              Pago parcial / Abono
            </button>
          </div>
        </div>

        {paymentMode !== "none" && (
          <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-3">
            {paymentMode === "partial" ? (
              <label className="block text-xs font-semibold text-slate-700">
                Monto del abono ({prefix}) *
                <input
                  type="number"
                  min="1"
                  max={calc.total}
                  step="0.01"
                  required
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="0.00"
                  className="input mt-1"
                />
              </label>
            ) : (
              <div>
                <span className="block text-xs font-semibold text-slate-700">Monto a cobrar ahora</span>
                <p className="mt-2 text-lg font-bold text-emerald-800">{fmt(calc.total)}</p>
              </div>
            )}

            <label className="block text-xs font-semibold text-slate-700">
              Método de pago *
              <select
                name="initial_payment_method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
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
              Referencia {paymentMethod !== "cash" ? "*" : "(opcional)"}
              <input
                name="initial_payment_reference"
                required={paymentMethod !== "cash"}
                placeholder={paymentMethod === "cash" ? "Opcional en efectivo" : "Núm. transferencia / voucher"}
                className="input mt-1"
              />
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="text-sm">
            <span className="text-slate-500">Balance pendiente tras emitir: </span>
            <span className="font-bold text-slate-900">{fmt(calc.balance)}</span>
          </div>
          <button type="submit" className="btn btn-primary px-6 py-2.5">
            Emitir Factura
          </button>
        </div>
      </section>
    </form>
  );
}
