"use client";
import { useMemo, useState } from "react";
import { VehicleCard } from "./VehicleCard";
import { fmt, type Lang } from "@/lib/i18n";
import type { PublicVehicle } from "@/server/services/public";

type Filter = "all" | "auto" | "seats5";
type Sort = "default" | "asc" | "desc";

export function CatalogGrid({ vehicles, lang, query, labels }: { vehicles: PublicVehicle[]; lang: Lang; query: string; labels: Record<string, string> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("default");
  const shown = useMemo(() => {
    let list = vehicles.filter((v) => filter === "all" || (filter === "auto" ? v.transmission === "automatic" : (v.seats ?? 0) >= 5));
    if (sort !== "default") list = [...list].sort((a, b) => (Number(a.daily_rate) - Number(b.daily_rate)) * (sort === "asc" ? 1 : -1));
    return list;
  }, [vehicles, filter, sort]);
  const chips: [Filter, string][] = [["all", labels["cat.fAll"]], ["auto", labels["cat.fAuto"]], ["seats5", labels["cat.fSeats5"]]];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group">
          {chips.map(([k, l]) => (<button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`chip ${filter === k ? "chip-active" : ""}`}>{l}</button>))}
        </div>
        <label className="flex items-center gap-2 text-sm">{labels["cat.sort"]}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input" style={{ marginTop: 0, width: "auto" }}>
            <option value="default">{labels["cat.sortDefault"]}</option><option value="asc">{labels["cat.sortAsc"]}</option><option value="desc">{labels["cat.sortDesc"]}</option>
          </select></label>
      </div>
      <p className="text-sm text-[var(--color-muted)]" aria-live="polite">{fmt(labels["cat.count"], { n: shown.length })}</p>
      {shown.length === 0 ? <p className="empty">{labels["cat.noMatch"]}</p> :
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{shown.map((v, i) => <VehicleCard key={v.id} v={v} lang={lang} query={query} index={i} />)}</div>}
    </div>
  );
}
