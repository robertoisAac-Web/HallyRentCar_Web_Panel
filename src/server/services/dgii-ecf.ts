import "server-only";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { getInvoiceDetail } from "./invoices";

export type DgiiEnvironment = "TesteCF" | "CerteCF" | "eCF";
export type EcfDocType = "E31" | "E32" | "E33" | "E34" | "E44" | "E45";

export const DGII_WS_ENDPOINTS: Record<
  DgiiEnvironment,
  {
    semilla: string;
    validacionCertificado: string;
    recepcionEcf: string;
    consultaResultado: string;
    consultaEstado: string;
  }
> = {
  TesteCF: {
    semilla: "https://ecf.dgii.gov.do/TesteCF/autenticacion/api/Autenticacion/Semilla",
    validacionCertificado: "https://ecf.dgii.gov.do/TesteCF/autenticacion/api/Autenticacion/ValidarSemilla",
    recepcionEcf: "https://ecf.dgii.gov.do/TesteCF/recepcion/api/FacturasElectronicas",
    consultaResultado: "https://ecf.dgii.gov.do/TesteCF/consultaresultado/api/Consultas/Estado",
    consultaEstado: "https://statusecf.dgii.gov.do/TesteCF/api/Consultas/Estado",
  },
  CerteCF: {
    semilla: "https://ecf.dgii.gov.do/CerteCF/autenticacion/api/Autenticacion/Semilla",
    validacionCertificado: "https://ecf.dgii.gov.do/CerteCF/autenticacion/api/Autenticacion/ValidarSemilla",
    recepcionEcf: "https://ecf.dgii.gov.do/CerteCF/recepcion/api/FacturasElectronicas",
    consultaResultado: "https://ecf.dgii.gov.do/CerteCF/consultaresultado/api/Consultas/Estado",
    consultaEstado: "https://statusecf.dgii.gov.do/CerteCF/api/Consultas/Estado",
  },
  eCF: {
    semilla: "https://ecf.dgii.gov.do/eCF/autenticacion/api/Autenticacion/Semilla",
    validacionCertificado: "https://ecf.dgii.gov.do/eCF/autenticacion/api/Autenticacion/ValidarSemilla",
    recepcionEcf: "https://ecf.dgii.gov.do/eCF/recepcion/api/FacturasElectronicas",
    consultaResultado: "https://ecf.dgii.gov.do/eCF/consultaresultado/api/Consultas/Estado",
    consultaEstado: "https://statusecf.dgii.gov.do/eCF/api/Consultas/Estado",
  },
};

export interface EcfSubmissionRow {
  id: string;
  company_id: string;
  invoice_id: string;
  environment: DgiiEnvironment;
  ecf_type: EcfDocType;
  encf: string | null;
  rnc_emisor: string;
  rnc_comprador: string | null;
  xml_unsigned: string;
  xml_signed: string | null;
  security_code: string | null;
  track_id: string | null;
  dgii_status: "draft_xml" | "signed" | "submitted" | "accepted" | "accepted_conditional" | "rejected" | "error";
  dgii_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateDgii(ymd: string): string {
  // Convierte YYYY-MM-DD a DD-MM-YYYY requerido por el estándar XML e-CF de la DGII
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
}

function sanitizeDigits(val: string | null | undefined): string {
  if (!val) return "";
  return val.replace(/\D/g, "");
}

/**
 * Construye el documento XML estándar <ECF> de la DGII (República Dominicana)
 * soportando E31 (Factura de Crédito Fiscal Electrónica), E32 (Factura de Consumo Electrónica),
 * E44 (Regímenes Especiales) y E45 (Gubernamental).
 */
export async function generateAndSaveEcfXml(
  invoiceId: string,
  options?: {
    ecfType?: EcfDocType;
    environment?: DgiiEnvironment;
  }
): Promise<EcfSubmissionRow> {
  const ctx = await requirePermission("payments:write");
  const detail = await getInvoiceDetail(invoiceId);
  if (!detail) throw new ValidationError("Factura no encontrada");

  const { invoice, items, customer, company, totals } = detail;

  const ecfType: EcfDocType =
    options?.ecfType ??
    (invoice.fiscal_type.startsWith("E")
      ? (invoice.fiscal_type as EcfDocType)
      : invoice.fiscal_type === "B01"
        ? "E31"
        : "E32");

  const tipoCodigo = ecfType.replace("E", ""); // "31", "32", "44", "45"
  const rncEmisor = sanitizeDigits(company.rnc) || "000000000";
  const rncComprador = sanitizeDigits(invoice.customer_tax_id || customer?.id_number);
  const razonSocialComprador = invoice.customer_tax_name || customer?.full_name || "CLIENTE CONSUMIDOR FINAL";

  // Si no hay e-NCF real asignado, se marca explícitamente como plantilla previa sin inventar secuencia fiscal
  const encfValue = invoice.ncf_or_ecf && invoice.ncf_or_ecf.startsWith("E") ? invoice.ncf_or_ecf : null;
  const encfXmlTag = encfValue ?? "PENDIENTE_ASIGNACION_DGII";

  const hasTax = Number(invoice.tax_rate) > 0 && totals.taxCents > 0;
  const taxableBase = ((totals.subtotalCents - totals.discountCents) / 100).toFixed(2);
  const taxAmount = (totals.taxCents / 100).toFixed(2);
  const totalAmount = (totals.totalCents / 100).toFixed(2);
  const tipoPago = totals.balanceCents <= 0 ? "1" : "2"; // 1 = Contado, 2 = Crédito

  const itemsXml = items
    .map((it, idx) => {
      const indicadorFacturacion = hasTax ? "1" : "4"; // 1 = ITBIS 18%, 4 = Exento
      return `    <Item>
      <NumeroLinea>${idx + 1}</NumeroLinea>
      <IndicadorFacturacion>${indicadorFacturacion}</IndicadorFacturacion>
      <NombreItem>${escapeXml(it.description.slice(0, 80))}</NombreItem>
      <IndicadorBienoServicio>2</IndicadorBienoServicio>
      <CantidadItem>${Number(it.quantity).toFixed(2)}</CantidadItem>
      <UnidadMedida>43</UnidadMedida>
      <PrecioUnitarioItem>${Number(it.unit_price).toFixed(2)}</PrecioUnitarioItem>
      <MontoItem>${Number(it.line_total).toFixed(2)}</MontoItem>
    </Item>`;
    })
    .join("\n");

  const totalesXml = hasTax
    ? `      <MontoGravadoTotal>${taxableBase}</MontoGravadoTotal>
      <MontoGravadoI1>${taxableBase}</MontoGravadoI1>
      <ITBIS1>18</ITBIS1>
      <TotalITBIS>${taxAmount}</TotalITBIS>
      <TotalITBIS1>${taxAmount}</TotalITBIS1>
      <MontoTotal>${totalAmount}</MontoTotal>`
    : `      <MontoExento>${taxableBase}</MontoExento>
      <MontoTotal>${totalAmount}</MontoTotal>`;

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

  const xmlUnsigned = `<?xml version="1.0" encoding="UTF-8"?>
<ECF>
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoeCF>${tipoCodigo}</TipoeCF>
      <eNCF>${escapeXml(encfXmlTag)}</eNCF>
      ${invoice.ncf_expiration_date ? `<FechaVencimientoSecuencia>${formatDateDgii(invoice.ncf_expiration_date)}</FechaVencimientoSecuencia>` : ""}
      <IndicadorMontoGravado>${hasTax ? "0" : "0"}</IndicadorMontoGravado>
      <TipoIngresos>01</TipoIngresos>
      <TipoPago>${tipoPago}</TipoPago>
    </IdDoc>
    <Emisor>
      <RNCEmisor>${escapeXml(rncEmisor)}</RNCEmisor>
      <RazonSocialEmisor>${escapeXml(company.legal_name || company.name)}</RazonSocialEmisor>
      <NombreComercial>${escapeXml(company.name)}</NombreComercial>
      <DireccionEmisor>${escapeXml(company.address || "Santo Domingo, República Dominicana")}</DireccionEmisor>
      <FechaEmision>${formatDateDgii(invoice.issue_date)}</FechaEmision>
    </Emisor>
    <Comprador>
      ${rncComprador ? `<RNCComprador>${escapeXml(rncComprador)}</RNCComprador>` : ""}
      <RazonSocialComprador>${escapeXml(razonSocialComprador)}</RazonSocialComprador>
    </Comprador>
    <Totales>
${totalesXml}
    </Totales>
  </Encabezado>
  <DetallesItems>
${itemsXml}
  </DetallesItems>
  <FechaHoraFirma>${escapeXml(nowDom)}</FechaHoraFirma>
</ECF>`;

  // Digest preliminar para trazabilidad de integridad del XML
  const hashHex = createHash("sha256").update(xmlUnsigned, "utf8").digest("hex");
  const environment: DgiiEnvironment = options?.environment ?? "TesteCF";

  const sb = await createClient();
  const { data, error } = await sb
    .from("dgii_ecf_submissions")
    .insert({
      company_id: ctx.companyId,
      invoice_id: invoice.id,
      environment,
      ecf_type: ecfType,
      encf: encfValue,
      rnc_emisor: rncEmisor,
      rnc_comprador: rncComprador || null,
      xml_unsigned: xmlUnsigned,
      dgii_status: "draft_xml",
      dgii_response: {
        schema_version: "1.0",
        xml_sha256: hashHex,
        endpoints: DGII_WS_ENDPOINTS[environment],
        note: encfValue
          ? "XML estructurado listo para firma digital X.509 (.p12) y envío a Recepción e-CF DGII."
          : "Estructura XML generada en modo preparación (pendiente de certificado digital .p12 y secuencia e-NCF autorizada).",
      },
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error guardando estructura e-CF:", error);
    throw new Error("No se pudo guardar el registro e-CF de la factura");
  }

  return data as EcfSubmissionRow;
}

export async function listEcfSubmissionsForInvoice(invoiceId: string): Promise<EcfSubmissionRow[]> {
  await requirePermission("payments:read");
  const sb = await createClient();
  const { data, error } = await sb
    .from("dgii_ecf_submissions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error listando e-CF submissions:", error);
    return [];
  }
  return (data ?? []) as EcfSubmissionRow[];
}
