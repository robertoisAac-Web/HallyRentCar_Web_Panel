import { NextRequest, NextResponse } from "next/server";

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Endpoint oficial exigido por la DGII para Recepción de e-CF de otros emisores:
 * POST /fe/recepcion/api/ecf
 * Recibe un e-CF y responde con un Acuse de Recibo (<ARECF>) estándar DGII v1.0.
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

    const rncEmisor = extractTag(rawXml, "RNCEmisor") || "000000000";
    const rncComprador = extractTag(rawXml, "RNCComprador") || "133683687";
    const encf = extractTag(rawXml, "eNCF") || "E310000000001";

    const nowDom = new Date().toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const arecfXml = `<?xml version="1.0" encoding="utf-8"?>
<ARECF>
  <DetalleAcusedeRecibo>
    <Version>1.0</Version>
    <RNCEmisor>${rncEmisor}</RNCEmisor>
    <RNCComprador>${rncComprador}</RNCComprador>
    <eNCF>${encf}</eNCF>
    <Estado>0</Estado>
    <FechaHoraAcuseRecibo>${nowDom}</FechaHoraAcuseRecibo>
  </DetalleAcusedeRecibo>
</ARECF>`;

    return new NextResponse(arecfXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error procesando recepción de e-CF." },
      { status: 500 }
    );
  }
}
