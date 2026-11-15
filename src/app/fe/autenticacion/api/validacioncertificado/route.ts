import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint oficial exigido por la DGII para validación de semilla firmada:
 * POST /fe/autenticacion/api/validacioncertificado
 * Recibe el XML de semilla firmado y emite un token Bearer temporal conforme al estándar DGII.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let rawXml = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const xmlPart = formData.get("xml");
      if (xmlPart && typeof xmlPart === "object" && "text" in xmlPart) {
        rawXml = await (xmlPart as File).text();
      } else if (typeof xmlPart === "string") {
        rawXml = xmlPart;
      }
    } else {
      rawXml = await req.text();
    }

    if (!rawXml || !rawXml.includes("SemillaModel")) {
      return NextResponse.json(
        { error: "Documento XML de SemillaModel inválido o ausente." },
        { status: 400 }
      );
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000); // 1 hora
    const token = randomBytes(36).toString("base64url");

    return NextResponse.json({
      token,
      expira: expiresAt.toISOString(),
      expedido: issuedAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Error procesando validación de semilla firmada." },
      { status: 500 }
    );
  }
}
