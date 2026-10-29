"use client";
import { useRouter } from "next/navigation";

export function LangToggle({ current, label }: { current: "es" | "en"; label: string }) {
  const router = useRouter();
  const next = current === "es" ? "en" : "es";
  return (
    <button type="button" aria-label={label} title={label} className="btn btn-secondary btn-sm"
      onClick={() => { document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`; router.refresh(); }}>
      {next.toUpperCase()}
    </button>
  );
}
