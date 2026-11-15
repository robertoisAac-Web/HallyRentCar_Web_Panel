import { NextRequest, NextResponse } from "next/server";

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Endpoint oficial exigido por la DGII para Recepción de Aprobación Comercial (<ACECF>):
 * POST /fe/aprobacioncomercial/api/ecf
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

    const encf = extractTag(rawXml, "eNCF");
    const estado = extractTag(rawXml, "Estado") || "1";

    return NextResponse.json({
      codigo: 0,
      estado: "Aprobación Comercial recibida satisfactoriamente",
      encf: encf || null,
      estadoComercial: estado,
    });
  } catch {
    return NextResponse.json(
      { codigo: 1, error: "Error procesando Aprobación Comercial ACECF." },
      { status: 500 }
    );
  }
}
