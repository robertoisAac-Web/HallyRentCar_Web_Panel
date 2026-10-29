"use client";
import { useState } from "react";

export function ThemeToggle({ label }: { label: string }) {
  const [, force] = useState(0);
  function toggle() {
    const root = document.querySelector<HTMLElement>(".public-root");
    if (!root) return;
    const current = root.getAttribute("data-theme");
    const effective = current === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : current;
    const next = effective === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    force((n) => n + 1);
  }
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className="btn btn-secondary btn-sm" style={{ padding: ".4rem .55rem" }}>
      <svg className="theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      <svg className="theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  );
}
