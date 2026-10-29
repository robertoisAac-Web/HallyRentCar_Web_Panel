"use client";
import { useEffect, useId, useRef, useState } from "react";
import { businessYmd } from "@/lib/dates";
import type { Lang } from "@/lib/i18n";
import {
  PICKER_TEXT, compareDay, compose, formatDisplay, from12h, monthGrid, parseValue, shiftMonthView, to12h, ymdOf,
} from "@/lib/datepicker";

export interface DateTimePickerProps {
  name: string; label?: string; mode?: "date" | "datetime"; lang?: Lang;
  value?: string; defaultValue?: string; onChange?: (v: string) => void;
  min?: string; max?: string; required?: boolean; className?: string;
}
const MINUTES = [0, 15, 30, 45];
const DEFAULT_HOUR = 10;

export function DateTimePicker({ name, label, mode = "datetime", lang = "es", value, defaultValue, onChange, min, max, required, className }: DateTimePickerProps) {
  const T = PICKER_TEXT[lang];
  const id = useId();
  const [inner, setInner] = useState(value ?? defaultValue ?? "");
  const current = value !== undefined ? value : inner;
  const parts = parseValue(current);
  const today = businessYmd(new Date());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ year: parts?.y ?? +today.slice(0, 4), month: parts?.m ?? +today.slice(5, 7) }));
  const root = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (root.current) {
      const rect = root.current.getBoundingClientRect();
      const popoverWidth = mode === "datetime" ? 600 : 340;
      if (rect.left + popoverWidth > window.innerWidth && rect.right >= 320) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    }
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, mode]);

  function commit(v: string) { setInner(v); onChange?.(v); }
  const disabledDay = (ymd: string) => (min ? compareDay(ymd, min) < 0 : false) || (max ? compareDay(ymd, max) > 0 : false);

  function pickDay(ymd: string) {
    if (disabledDay(ymd)) return;
    if (mode === "date") { commit(ymd); setOpen(false); return; }
    commit(compose(ymd, parts?.hh ?? DEFAULT_HOUR, parts?.mm ?? 0));
  }
  function setTime(h12: number | null, pm: boolean | null, minutes: number | null) {
    if (!parts) return;
    const cur = to12h(parts.hh ?? DEFAULT_HOUR);
    commit(compose(ymdOf(parts), from12h(h12 ?? cur.h12, pm ?? cur.pm), minutes ?? parts.mm ?? 0));
  }
  function onGridKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement; const ymd = t.dataset.ymd;
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number | undefined>)[e.key];
    if (!ymd || !delta) return;
    e.preventDefault();
    const p = parseValue(ymd)!; const d = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-ymd="${next}"]`)?.focus());
  }

  const weeks = monthGrid(view.year, view.month);
  const time = parts?.hh !== null && parts?.hh !== undefined ? to12h(parts.hh) : null;
  const selectedDay = parts ? ymdOf(parts) : null;

  return (
    <div ref={root} className={`dtp ${className ?? ""}`}>
      {label && <span id={`${id}-l`} className="field-label">{label}{required ? " *" : ""}</span>}
      <button type="button" className="dtp-trigger" aria-haspopup="dialog" aria-expanded={open} aria-labelledby={label ? `${id}-l ${id}-v` : undefined}
        onClick={() => { if (!open && parts) setView({ year: parts.y, month: parts.m }); setOpen((o) => !o); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        <span id={`${id}-v`} className={current ? "" : "dtp-ph"}>{current ? formatDisplay(current, lang, mode) : (mode === "date" ? T.placeholder : T.placeholderTime)}</span>
      </button>
      {/* Campo real que viaja en el formulario (y activa la validación de "obligatorio"). */}
      <input className="dtp-field" name={name} value={current} required={required} tabIndex={-1} aria-hidden="true" onChange={() => {}} />

      {open && (
        <div
          role="dialog"
          aria-label={T.open}
          className={`dtp-pop ${mode === "datetime" ? "dtp-datetime" : "dtp-date-only"} ${alignRight ? "dtp-pop-right" : ""}`}
        >
          <div className="dtp-body">
            <div className="dtp-cal-side">
              <div className="dtp-head">
                <button type="button" className="dtp-nav" aria-label={T.prev} onClick={() => setView((v) => shiftMonthView(v.year, v.month, -1))}>‹</button>
                <span className="dtp-title">{T.months[view.month - 1]} {view.year}</span>
                <button type="button" className="dtp-nav" aria-label={T.next} onClick={() => setView((v) => shiftMonthView(v.year, v.month, 1))}>›</button>
              </div>
              <div className="dtp-grid dtp-wd" aria-hidden="true">{T.weekdays.map((w) => <span key={w}>{w}</span>)}</div>
              <div onKeyDown={onGridKey}>
                {weeks.map((w, i) => (
                  <div key={i} className="dtp-grid">{w.map((ymd, j) => ymd ? (
                    <button key={ymd} type="button" data-ymd={ymd} disabled={disabledDay(ymd)} aria-pressed={selectedDay === ymd}
                      aria-label={formatDisplay(ymd, lang, "date")}
                      className={`dtp-day ${selectedDay === ymd ? "is-sel" : ""} ${ymd === today ? "is-today" : ""}`} onClick={() => pickDay(ymd)}>{+ymd.slice(8)}</button>
                  ) : <span key={j} />)}</div>))}
              </div>
            </div>

            {mode === "datetime" && (
              <div className="dtp-time-side">
                <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-slate-100">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-brand)]"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Hora seleccionada</span>
                  <span className="ml-auto text-xs font-bold text-[var(--color-brand)] bg-[var(--color-brand-soft)] px-2.5 py-0.5 rounded-full">
                    {time ? `${String(time.h12).padStart(2, "0")}:${String(parts?.mm ?? 0).padStart(2, "0")} ${time.pm ? "PM" : "AM"}` : "10:00 AM"}
                  </span>
                </div>

                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ajustar horario</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">HORA</label>
                    <select
                      disabled={!parts}
                      value={time?.h12 ?? 10}
                      onChange={(e) => setTime(Number(e.target.value), null, null)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-[var(--color-brand)] focus:outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">MIN</label>
                    <select
                      disabled={!parts}
                      value={parts?.mm ?? 0}
                      onChange={(e) => setTime(null, null, Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-[var(--color-brand)] focus:outline-none"
                    >
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>
                          :{String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">TURNO</label>
                    <select
                      disabled={!parts}
                      value={time?.pm ? "PM" : "AM"}
                      onChange={(e) => setTime(null, e.target.value === "PM", null)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-[var(--color-brand)] focus:outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* Accesos rápidos */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Horarios frecuentes</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "08:00 AM", h: 8, pm: false, m: 0 },
                      { label: "10:00 AM", h: 10, pm: false, m: 0 },
                      { label: "02:00 PM", h: 2, pm: true, m: 0 },
                      { label: "06:00 PM", h: 6, pm: true, m: 0 },
                    ].map((slot) => {
                      const isSlot = time?.h12 === slot.h && time?.pm === slot.pm && (parts?.mm ?? 0) === slot.m;
                      return (
                        <button
                          key={slot.label}
                          type="button"
                          disabled={!parts}
                          onClick={() => {
                            if (!parts) return;
                            commit(compose(ymdOf(parts), from12h(slot.h, slot.pm), slot.m));
                          }}
                          className={`rounded-lg py-1.5 px-2 text-xs font-semibold text-center border transition-all cursor-pointer ${
                            isSlot
                              ? "bg-[#0c1e2e] text-white border-[#76e012] shadow-xs font-bold"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>)}
          </div>

          <div className="dtp-foot">
            <button type="button" className="dtp-link" onClick={() => pickDay(today)} disabled={disabledDay(today)}>{T.today}</button>
            {!required && current && <button type="button" className="dtp-link" onClick={() => { commit(""); }}>{T.clear}</button>}
            <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={() => setOpen(false)}>{T.done}</button>
          </div>
        </div>)}
    </div>
  );
}
