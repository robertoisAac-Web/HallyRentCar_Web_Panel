import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

/**
 * Endpoint oficial exigido por la DGII para la interconexión del contribuyente:
 * GET /fe/autenticacion/api/semilla
 * Genera y retorna el XML <SemillaModel> para autenticación de emisores electrónicos.
 */
export async function GET() {
  const seedValue = randomBytes(32).toString("base64");
  const nowIso = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<SemillaModel xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <valor>${seedValue}</valor>
  <fecha>${nowIso}</fecha>
</SemillaModel>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
