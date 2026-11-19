"use client";
import { useState } from "react";

export function ThemeToggle({ label }: { label: string }) {
  const [, force] = useState(0);
  function toggle() {
    const root = document.querySelector<HTMLElement>(".public-root");
    if (!root) return;
    const current = root.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    force((n) => n + 1);
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
    >
      <svg className="theme-icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      <svg className="theme-icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  );
}
