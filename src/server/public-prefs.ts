import "server-only";
import { cookies } from "next/headers";
import { resolveLang, type Lang } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";
export async function getPrefs(): Promise<{ lang: Lang; theme: Theme }> {
  const c = await cookies();
  const th = c.get("theme")?.value;
  return { lang: resolveLang(c.get("lang")?.value), theme: th === "dark" || th === "light" ? th : "system" };
}
