import { NextRequest, NextResponse } from "next/server";
import {
  generateAndSaveEcfXml,
  listEcfSubmissionsForInvoice,
  DGII_WS_ENDPOINTS,
  type EcfDocType,
  type DgiiEnvironment,
} from "@/server/services/dgii-ecf";
import { errorMessage } from "@/lib/action-error";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId")?.trim();
    const submissionId = searchParams.get("submissionId")?.trim();
    const download = searchParams.get("download") === "1";

    if (!invoiceId) {
      return NextResponse.json(
        { ok: false, error: "Parámetro invoiceId requerido", endpoints: DGII_WS_ENDPOINTS },
        { status: 400 }
      );
    }

    const submissions = await listEcfSubmissionsForInvoice(invoiceId);
    const selected = submissionId
      ? submissions.find((s) => s.id === submissionId) ?? submissions[0]
      : submissions[0];

    if (download) {
      if (!selected) {
        return NextResponse.json(
          { ok: false, error: "No existe un XML e-CF generado para esta factura." },
          { status: 404 }
        );
      }

      const fileName = `${selected.encf || `ECF_${selected.ecf_type}_${invoiceId.slice(0, 8)}`}.xml`;
      return new NextResponse(selected.xml_signed || selected.xml_unsigned, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      invoiceId,
      latest: selected ?? null,
      submissions,
      dgiiEndpoints: DGII_WS_ENDPOINTS,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const invoiceId = String(body.invoiceId ?? "").trim();
    if (!invoiceId) {
      return NextResponse.json({ ok: false, error: "invoiceId es obligatorio." }, { status: 400 });
    }

    const ecfTipoRaw = String(body.ecfTipo ?? body.ecfType ?? "E32").trim();
    const ecfType: EcfDocType =
      ecfTipoRaw === "E31" || ecfTipoRaw === "E44" || ecfTipoRaw === "E45" ? ecfTipoRaw : "E32";
    const envRaw = String(body.environment ?? "TesteCF").trim();
    const environment: DgiiEnvironment =
      envRaw === "CerteCF" || envRaw === "eCF" ? envRaw : "TesteCF";

    const submission = await generateAndSaveEcfXml(invoiceId, {
      ecfType,
      environment,
    });

    return NextResponse.json({
      ok: true,
      submission,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 400 });
  }
}
