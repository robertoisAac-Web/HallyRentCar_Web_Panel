/** Enlace de WhatsApp. Solo ABRE el chat con el mensaje escrito; no envía nada por sí solo. */
export function whatsappLink(number: string | null | undefined, text?: string): string | null {
  let digits = (number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = "1" + digits; // números dominicanos (809/829/849) sin código de país
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}
