"use client";
import { useState } from "react";

export function Gallery({ photos, alt, empty }: { photos: string[]; alt: string; empty: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) return <div className="flex h-72 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-title)]">{empty}</div>;
  return (
    <div className="space-y-3">
      <img src={photos[i]} alt={alt} className="h-72 w-full rounded-2xl object-cover md:h-96" />
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">{photos.map((p, n) => (
          <button key={p} type="button" onClick={() => setI(n)} aria-label={`${alt} ${n + 1}`} aria-current={n === i}
            className={`shrink-0 overflow-hidden rounded-lg border-2 ${n === i ? "border-[var(--color-brand)]" : "border-transparent opacity-70 hover:opacity-100"}`}>
            <img src={p} alt="" loading="lazy" className="h-16 w-24 object-cover" /></button>))}</div>)}
    </div>
  );
}
