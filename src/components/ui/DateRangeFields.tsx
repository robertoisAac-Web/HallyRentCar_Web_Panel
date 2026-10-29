"use client";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { PICKER_TEXT, addDays, compareDay } from "@/lib/datepicker";
import { DateTimePicker } from "./DateTimePicker";

/** Dos selectores enlazados (inicio y fin) presentados en horizontal con atajos de duración. */
export function DateRangeFields({
  startName,
  endName,
  startLabel,
  endLabel,
  lang = "es",
  defaultStart = "",
  defaultEnd = "",
  minStart,
  required = true,
  quick = true,
}: {
  startName: string;
  endName: string;
  startLabel: string;
  endLabel: string;
  lang?: Lang;
  defaultStart?: string;
  defaultEnd?: string;
  minStart?: string;
  required?: boolean;
  quick?: boolean;
}) {
  const T = PICKER_TEXT[lang];
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  function onStart(v: string) {
    setStart(v);
    if (v && end && (compareDay(end, v) < 0 || end <= v)) {
      setEnd(addDays(v, 1));
    }
  }

  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
        <DateTimePicker
          name={startName}
          label={startLabel}
          lang={lang}
          value={start}
          onChange={onStart}
          min={minStart}
          required={required}
        />
        <DateTimePicker
          name={endName}
          label={endLabel}
          lang={lang}
          value={end}
          onChange={setEnd}
          min={start || minStart}
          required={required}
        />
      </div>
      {quick && (
        <div className="flex flex-wrap items-center gap-2 text-sm pt-0.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">{T.quick}:</span>
          {([[1, T.d1], [3, T.d3], [7, T.w1]] as const).map(([n, text]) => (
            <button
              key={n}
              type="button"
              disabled={!start}
              className="chip text-xs py-1 px-2.5 transition-colors cursor-pointer"
              onClick={() => setEnd(addDays(start, n))}
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
