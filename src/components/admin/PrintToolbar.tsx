"use client";

import Link from "next/link";

export function PrintToolbar({
  backHref,
  backLabel = "Volver a la factura",
  docTitle,
}: {
  backHref: string;
  backLabel?: string;
  docTitle: string;
}) {
  function handlePrint() {
    if (typeof window !== "undefined") {
      const prevTitle = document.title;
      document.title = docTitle;
      window.print();
      document.title = prevTitle;
    }
  }

  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <Link href={backHref} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
        ← {backLabel}
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 sm:inline">
          En el diálogo de impresión selecciona <strong>Guardar como PDF</strong> para descargar el archivo.
        </span>
        <button type="button" onClick={handlePrint} className="btn btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span>Descargar PDF / Imprimir</span>
        </button>
      </div>
    </div>
  );
}
