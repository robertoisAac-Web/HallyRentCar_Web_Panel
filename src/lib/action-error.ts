import { ValidationError } from "@/lib/validators/common";
export function errorMessage(e: unknown): string {
  if (e instanceof ValidationError) return e.message;
  console.error(e);
  return "Ocurrió un error inesperado";
}
