import "server-only";
import { createHash, createSign } from "crypto";
import forge from "node-forge";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/permissions";
import { ValidationError } from "@/lib/validators/common";
import { getInvoiceDetail } from "./invoices";

export function extractP12Credentials(p12Base64: string, password: string): {
  privateKeyPem: string;
  certBase64Der: string;
  subjectName: string;
} {
  try {
    const derBytes = forge.util.decode64(p12Base64);
    const asn1 = forge.asn1.fromDer(derBytes);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];
    const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })[
      forge.pki.oids.keyBag
    ] ?? [];
    const allKeyBags = [...keyBags, ...plainKeyBags];
    const keyObj = allKeyBags.find((b) => b.key)?.key;
    if (!keyObj) {
      throw new Error("No se encontró la clave privada dentro del archivo .p12");
    }

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] ?? [];
    const certObj = certBags.find((b) => b.cert)?.cert;
    if (!certObj) {
      throw new Error("No se encontró el certificado X.509 dentro del archivo .p12");
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyObj);
    const certAsn1 = forge.pki.certificateToAsn1(certObj);
    const certDer = forge.asn1.toDer(certAsn1).getBytes();
    const certBase64Der = forge.util.encode64(certDer);

    const cnAttr = certObj.subject.getField("CN");
    const subjectName = cnAttr ? String(cnAttr.value) : "Certificado Tributario DGII";

    return { privateKeyPem, certBase64Der, subjectName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("mac") || msg.toLowerCase().includes("password")) {
      throw new ValidationError("La contraseña del certificado .p12 es incorrecta. Verifícala e intenta de nuevo.");
    }
    throw new ValidationError("No se pudo abrir el certificado .p12 con la contraseña indicada.");
  }
}

export function signDgiiXmlWithP12(
  xmlUnsigned: string,
  p12Base64: string,
  p12Password: string
): {
  xmlSigned: string;
  securityCode: string;
  subjectName: string;
} {
  const { privateKeyPem, certBase64Der, subjectName } = extractP12Credentials(p12Base64, p12Password);

  const cleanBody = xmlUnsigned
    .replace(/^<\?xml[^>]*\?>\s*/i, "")
    .trim();

  const digestBase64 = createHash("sha256").update(cleanBody, "utf8").digest("base64");

  const signedInfoXml = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod><DigestValue>${digestBase64}</DigestValue></Reference></SignedInfo>`;

  const signer = createSign("RSA-SHA256");
  signer.update(signedInfoXml, "utf8");
  signer.end();
  const signatureBase64 = signer.sign(privateKeyPem, "base64");

  // Código de Seguridad oficial DGII: primeros 6 caracteres del SignatureValue
  const securityCode = signatureBase64.slice(0, 6);

  const signatureBlock = `  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    ${signedInfoXml}
    <SignatureValue>${signatureBase64}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certBase64Der}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`;

  const xmlSigned = xmlUnsigned.replace(/<\/ECF>\s*$/i, `${signatureBlock}\n</ECF>`);

  return { xmlSigned, securityCode, subjectName };
}

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
      <RazonSocialEmisor>${escapeXml(company.legal_name || "HALLY RENT A CAR E INVERSIONES S.R.L.")}</RazonSocialEmisor>
      <NombreComercial>${escapeXml(company.name || "Hally Rent a Car")}</NombreComercial>
      <DireccionEmisor>${escapeXml(company.address || "Calle de Febrero, Edif. 2, Res. Quintas Jeremy Francisco del Rosario Sánchez #27, Sector Los Frailes, Santo Domingo Este")}</DireccionEmisor>
      <Municipio>320100</Municipio>
      <Provincia>320000</Provincia>
      <TablaTelefonoEmisor>
        <TelefonoEmisor>${escapeXml(company.phone || "809-854-9733")}</TelefonoEmisor>
      </TablaTelefonoEmisor>
      <CorreoEmisor>jrubiocuello@gmail.com</CorreoEmisor>
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
  const { data: dgiiCfg } = await sb
    .from("dgii_settings")
    .select("p12_base64,p12_password")
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  let xmlSigned: string | null = null;
  let securityCode: string | null = null;
  let signerSubject: string | null = null;

  if (dgiiCfg?.p12_base64 && dgiiCfg?.p12_password) {
    try {
      const signedRes = signDgiiXmlWithP12(
        xmlUnsigned,
        dgiiCfg.p12_base64 as string,
        dgiiCfg.p12_password as string
      );
      xmlSigned = signedRes.xmlSigned;
      securityCode = signedRes.securityCode;
      signerSubject = signedRes.subjectName;

      // Actualizar el código de seguridad de 6 dígitos en la factura
      await sb
        .from("invoices")
        .update({ security_code: securityCode })
        .eq("id", invoice.id);
    } catch (e) {
      console.error("Advertencia al firmar XML con .p12:", e);
    }
  }

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
      xml_signed: xmlSigned,
      security_code: securityCode,
      dgii_status: xmlSigned ? "signed" : "draft_xml",
      dgii_response: {
        schema_version: "1.0",
        xml_sha256: hashHex,
        signed_by: signerSubject,
        endpoints: DGII_WS_ENDPOINTS[environment],
        note: xmlSigned
          ? `XML firmado digitalmente con certificado .p12 (${signerSubject}). Código de Seguridad: ${securityCode}`
          : "Estructura XML generada (sube el certificado .p12 en Configuración para firmarlo digitalmente).",
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

export interface DgiiSettingsRow {
  company_id: string;
  environment: DgiiEnvironment;
  integration_mode: "direct_dgii" | "psfe";
  default_tax_rate: string;
  auto_assign_sequence: boolean;
  p12_file_name: string | null;
  has_p12_certificate: boolean;
  has_p12_password: boolean;
  p12_uploaded_at: string | null;
  psfe_provider: string | null;
  psfe_api_url: string | null;
  has_psfe_token: boolean;
  updated_at: string;
}

export interface DgiiSequenceRow {
  id: string;
  company_id: string;
  fiscal_type: "B01" | "B02" | "B14" | "B15" | "E31" | "E32" | "E33" | "E34" | "E44" | "E45";
  prefix: string;
  padding_length: number;
  start_number: number;
  end_number: number;
  current_number: number;
  expiration_date: string | null;
  authorization_number: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getDgiiSettings(): Promise<DgiiSettingsRow> {
  const ctx = await requirePermission("payments:read");
  const sb = await createClient();
  const { data } = await sb
    .from("dgii_settings")
    .select("*")
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!data) {
    return {
      company_id: ctx.companyId,
      environment: "TesteCF",
      integration_mode: "direct_dgii",
      default_tax_rate: "18.00",
      auto_assign_sequence: true,
      p12_file_name: null,
      has_p12_certificate: false,
      has_p12_password: false,
      p12_uploaded_at: null,
      psfe_provider: null,
      psfe_api_url: null,
      has_psfe_token: false,
      updated_at: new Date().toISOString(),
    };
  }

  return {
    company_id: data.company_id as string,
    environment: (data.environment as DgiiEnvironment) ?? "TesteCF",
    integration_mode: (data.integration_mode as "direct_dgii" | "psfe") ?? "direct_dgii",
    default_tax_rate: String(data.default_tax_rate ?? "18.00"),
    auto_assign_sequence: Boolean(data.auto_assign_sequence),
    p12_file_name: (data.p12_file_name as string | null) ?? null,
    has_p12_certificate: Boolean(data.p12_base64),
    has_p12_password: Boolean(data.p12_password),
    p12_uploaded_at: (data.p12_uploaded_at as string | null) ?? null,
    psfe_provider: (data.psfe_provider as string | null) ?? null,
    psfe_api_url: (data.psfe_api_url as string | null) ?? null,
    has_psfe_token: Boolean(data.psfe_api_token),
    updated_at: data.updated_at as string,
  };
}

export async function updateDgiiSettings(input: {
  environment: DgiiEnvironment;
  integration_mode: "direct_dgii" | "psfe";
  default_tax_rate: number;
  auto_assign_sequence: boolean;
  p12_file_name?: string | null;
  p12_base64?: string | null;
  p12_password?: string | null;
  psfe_provider?: string | null;
  psfe_api_url?: string | null;
  psfe_api_token?: string | null;
}) {
  const ctx = await requirePermission("company:manage");
  const sb = await createClient();

  const patch: Record<string, unknown> = {
    company_id: ctx.companyId,
    environment: input.environment,
    integration_mode: input.integration_mode,
    default_tax_rate: Number.isFinite(input.default_tax_rate) ? input.default_tax_rate : 18,
    auto_assign_sequence: input.auto_assign_sequence,
    psfe_provider: input.psfe_provider?.trim() || null,
    psfe_api_url: input.psfe_api_url?.trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: ctx.userId,
  };

  const { data: existingCfg } = await sb
    .from("dgii_settings")
    .select("p12_base64,p12_password")
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  const finalBase64 =
    input.p12_base64 && input.p12_file_name
      ? input.p12_base64
      : (existingCfg?.p12_base64 as string | null) ?? null;
  const finalPassword =
    input.p12_password && input.p12_password.trim().length > 0
      ? input.p12_password.trim()
      : (existingCfg?.p12_password as string | null) ?? null;

  if (finalBase64 && finalPassword && (input.p12_base64 || input.p12_password)) {
    // Validar en vivo que la contraseña abre el certificado .p12 correctamente
    extractP12Credentials(finalBase64, finalPassword);
  }

  if (input.p12_base64 && input.p12_file_name) {
    patch.p12_file_name = input.p12_file_name;
    patch.p12_base64 = input.p12_base64;
    patch.p12_uploaded_at = new Date().toISOString();
  }
  if (input.p12_password && input.p12_password.trim().length > 0) {
    patch.p12_password = input.p12_password.trim();
  }
  if (input.psfe_api_token && input.psfe_api_token.trim().length > 0) {
    patch.psfe_api_token = input.psfe_api_token.trim();
  }

  const { error } = await sb.from("dgii_settings").upsert(patch, { onConflict: "company_id" });
  if (error) {
    console.error("Error guardando dgii_settings:", error);
    throw new Error(error.message || "No se pudo guardar la configuración fiscal DGII");
  }
}

export async function listDgiiSequences(): Promise<DgiiSequenceRow[]> {
  const ctx = await requirePermission("payments:read");
  const sb = await createClient();
  const { data, error } = await sb
    .from("dgii_sequences")
    .select("*")
    .eq("company_id", ctx.companyId)
    .order("is_active", { ascending: false })
    .order("fiscal_type", { ascending: true });

  if (error) {
    console.error("Error listando secuencias DGII:", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    fiscal_type: r.fiscal_type as DgiiSequenceRow["fiscal_type"],
    prefix: r.prefix as string,
    padding_length: Number(r.padding_length ?? 10),
    start_number: Number(r.start_number),
    end_number: Number(r.end_number),
    current_number: Number(r.current_number),
    expiration_date: (r.expiration_date as string | null) ?? null,
    authorization_number: (r.authorization_number as string | null) ?? null,
    is_active: Boolean(r.is_active),
    created_at: r.created_at as string,
  }));
}

export async function createDgiiSequence(input: {
  fiscal_type: DgiiSequenceRow["fiscal_type"];
  start_number: number;
  end_number: number;
  next_number?: number;
  expiration_date?: string;
  authorization_number?: string;
}) {
  const ctx = await requirePermission("company:manage");
  if (!Number.isFinite(input.start_number) || input.start_number < 1) {
    throw new ValidationError("El número inicial de la secuencia debe ser mayor o igual a 1");
  }
  if (!Number.isFinite(input.end_number) || input.end_number < input.start_number) {
    throw new ValidationError("El número final debe ser mayor o igual al número inicial");
  }

  const nextNum =
    input.next_number && Number.isFinite(input.next_number) && input.next_number >= input.start_number
      ? input.next_number
      : input.start_number;
  const currentNumber = nextNum - 1;
  const isEcf = input.fiscal_type.startsWith("E");
  const paddingLength = isEcf ? 10 : 8;

  const sb = await createClient();
  const { error } = await sb.from("dgii_sequences").insert({
    company_id: ctx.companyId,
    fiscal_type: input.fiscal_type,
    prefix: input.fiscal_type,
    padding_length: paddingLength,
    start_number: input.start_number,
    end_number: input.end_number,
    current_number: currentNumber,
    expiration_date: input.expiration_date?.trim() || null,
    authorization_number: input.authorization_number?.trim() || null,
    is_active: true,
    created_by: ctx.userId,
  });

  if (error) {
    console.error("Error creando secuencia DGII:", error);
    throw new Error(error.message || "No se pudo registrar la secuencia de comprobantes");
  }
}

export async function toggleDgiiSequence(id: string, isActive: boolean) {
  const ctx = await requirePermission("company:manage");
  const sb = await createClient();
  const { error } = await sb
    .from("dgii_sequences")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("company_id", ctx.companyId);

  if (error) {
    throw new Error(error.message || "No se pudo actualizar el estado de la secuencia");
  }
}

export async function consumeNextDgiiSequence(
  companyId: string,
  fiscalType: string
): Promise<{ ncf_or_ecf: string; expiration_date: string | null } | null> {
  if (!fiscalType || fiscalType === "none") return null;
  const sb = await createClient();
  const { data, error } = await sb.rpc("consume_next_dgii_sequence", {
    p_company_id: companyId,
    p_fiscal_type: fiscalType,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0] as { ncf_or_ecf?: string; expiration_date?: string | null };
  if (!row.ncf_or_ecf) return null;
  return {
    ncf_or_ecf: row.ncf_or_ecf,
    expiration_date: row.expiration_date ?? null,
  };
}
