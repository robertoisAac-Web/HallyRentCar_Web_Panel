import QRCode from "qrcode";

function formatDgiiDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
}

export async function buildDgiiQrUrl(params: {
  environment?: "TesteCF" | "CerteCF" | "eCF";
  rncEmisor: string;
  rncComprador?: string | null;
  encf: string;
  fechaEmision: string;
  montoTotal: string;
  fechaFirma?: string | null;
  codigoSeguridad: string;
}): Promise<{ url: string; svg: string }> {
  const env = params.environment ?? "TesteCF";
  const rncEmisor = params.rncEmisor.replace(/\D/g, "") || "133683687";
  const rncComp = params.rncComprador ? params.rncComprador.replace(/\D/g, "") : "";
  const fechaEmision = formatDgiiDate(params.fechaEmision);
  const fechaFirma = params.fechaFirma || `${fechaEmision} 10:00:00`;

  const qs = new URLSearchParams();
  qs.set("RncEmisor", rncEmisor);
  if (rncComp) qs.set("RncComprador", rncComp);
  qs.set("ENCF", params.encf);
  qs.set("FechaEmision", fechaEmision);
  qs.set("MontoTotal", params.montoTotal);
  qs.set("FechaFirma", fechaFirma);
  qs.set("CodigoSeguridad", params.codigoSeguridad);

  const url = `https://ecf.dgii.gov.do/${env}/ConsultaTimbre?${qs.toString()}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    width: 96,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });

  return { url, svg };
}

export async function DgiiQrStamp({
  environment = "TesteCF",
  rncEmisor,
  rncComprador,
  encf,
  fechaEmision,
  montoTotal,
  fechaFirma,
  codigoSeguridad,
  isFiscal = false,
}: {
  environment?: "TesteCF" | "CerteCF" | "eCF";
  rncEmisor: string;
  rncComprador?: string | null;
  encf: string;
  fechaEmision: string;
  montoTotal: string;
  fechaFirma?: string | null;
  codigoSeguridad: string;
  isFiscal?: boolean;
}) {
  const { svg } = await buildDgiiQrUrl({
    environment,
    rncEmisor,
    rncComprador,
    encf,
    fechaEmision,
    montoTotal,
    fechaFirma,
    codigoSeguridad,
  });

  const displayFechaFirma = fechaFirma || `${formatDgiiDate(fechaEmision)} 10:00:00`;

  return (
    <div className="flex items-start gap-3.5 pt-2">
      <div
        className="h-24 w-24 shrink-0 border border-neutral-300 bg-white p-1.5"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="space-y-0.5 text-[11px] leading-snug text-neutral-600 pt-0.5">
        <p className="font-semibold text-neutral-900">
          {isFiscal ? "Timbre Fiscal Electrónico DGII (e-CF)" : "Código QR de Verificación / Pre-eCF DGII"}
        </p>
        <p>
          Código de Seguridad:{" "}
          <span className="font-mono font-bold text-neutral-900">{codigoSeguridad}</span>
        </p>
        <p>
          Fecha de Firma Digital:{" "}
          <span className="font-mono text-neutral-800">{displayFechaFirma}</span>
        </p>
        <p className="text-[10px] text-neutral-400">
          RNC Emisor: {rncEmisor} · {encf}
        </p>
      </div>
    </div>
  );
}
