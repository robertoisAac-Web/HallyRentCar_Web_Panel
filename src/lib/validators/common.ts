import { z } from "zod";
export class ValidationError extends Error {}
export const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
export const moneyString = (label: string) =>
  z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, `${label} inválido (ejemplo: 100 o 100.50)`);
export const formValue = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
};
