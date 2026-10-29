# Estado
## Verificado por el usuario en su equipo (Windows)
Fase 2: 13 pruebas de tarifas, typecheck, 3 migraciones, 9 pruebas pgTAP, login y redirección sin sesión.
## Escrito, verificado solo en lógica pura (40/40 pruebas con node:test)
Fase 3: vehículos (probado a medias), clientes, reservas (2 pasos, transiciones y permisos), calendario mensual, bloqueos/mantenimiento, dashboard real (sin dinero).
Las pantallas, servicios y consultas a Supabase NO se han ejecutado todavía.
## Pendiente de Fase 3
Editar una reserva (re-verificando disponibilidad), vistas diaria/semanal del calendario, fotos y documentos de vehículos, tarifas especiales, rentabilidad por vehículo, razón en el historial de estados, vencimiento automático de pendientes, filtros y paginación avanzados.
## Pendiente global
Fases 4-7: contratos PDF, checklists, pagos, depósitos, gastos, reportes, facturación e-CF, web pública, QA final.
## Riesgos conocidos
- RLS no distingue columnas: la regla "solo admin confirma" se aplica en el servicio, no en la base de datos (un usuario con la API directa y reservations:write podría saltarla).
- Sin protección contra desactivar al último administrador.
- Dependencias sin lockfile versionado en el repo.

## Diseño del panel (aplicado antes de Fase 4, por pedido del usuario)
Sistema visual en `src/app/globals.css` (tokens + clases .btn/.panel/.table/.badge/.plate/.nav-link), fuente Instrument Sans (next/font/google), menú lateral con iconos, matrícula como placa, tablero de flota en el inicio. Sin ejecutar todavía.
Pendiente de diseño: fotos de vehículos (requiere subida a almacenamiento privado/público), calendario con estilo propio, web pública.

## Fase 4 (operación) — escrita, SIN EJECUTAR
Migración 4 (`20261025000004_operations_money.sql`): pagos, cargos, depósitos, gastos, checklists, fotos, buckets de almacenamiento y RLS. Aplicar con `npx supabase migration up` (NO `db reset`).
Pantallas: pagos y depósitos en la reserva, entrega/devolución con checklist y fotos, gastos con comprobante, reportes con CSV, fotos de vehículos, dinero en el inicio.
Lógica pura verificada: 62/62 pruebas (saldos, depósitos, CSV, ocupación, rangos).
Pruebas de BD pendientes de ejecutar: `supabase/tests/002_money_integrity.sql` (10 casos).
## Pendiente
Contrato PDF (requiere instalar una librería), facturación fiscal (Fase 5), web pública (Fase 6), editar reserva, vistas diaria/semanal, tarifas especiales, documentos de clientes y de vehículos (seguro/vencimientos), usuarios y permisos desde el panel, configuración de la empresa desde el panel.

## Bloque 5 (web pública + administración) — escrito, SIN EJECUTAR
Migración 5 (`20261026000005_public_site_and_admin.sql`): datos públicos de la empresa, protección del último admin, documentos de vehículos, notas de riesgo, función `create_public_request` (solo service_role) y `expire_pending_reservations`.
Panel: configuración de la empresa, usuarios y permisos por rol, documentos de vehículos con alertas de vencimiento, alertas en el inicio (devoluciones atrasadas, licencias, solicitudes sin responder), WhatsApp en reservas y clientes, historial y riesgo del cliente.
Web pública: portada, catálogo con disponibilidad, solicitud de reserva, gracias con WhatsApp, condiciones.
Lógica pura verificada: 67/67. Pruebas de BD pendientes de ejecutar: `003_public_and_admin.sql` (9 casos).
## Pendiente (bloque 6)
Contrato (plantilla, versiones, vista imprimible), facturas y registro de e-CF externo con exportación para el contador y documento de preguntas fiscales, editar reserva, buscador general, vista diaria/semanal del calendario, tarifas especiales, rentabilidad por vehículo, multas y peajes, reserva de otra rent a car, respaldo/exportación, guía de despliegue, pruebas de punta a punta.

## Rediseño de la web pública — escrito, SIN EJECUTAR
Modo oscuro (cookie `theme`, respeta el modo del sistema), idioma ES/EN (cookie `lang`, diccionario en `src/lib/i18n.ts` con prueba de paridad), ficha de vehículo con galería, filtros y orden del catálogo, estimado de precio en vivo en el formulario (usa la misma función de días facturables que el servidor), botón flotante de WhatsApp, preguntas frecuentes, animaciones que respetan "reducir movimiento", encabezado fijo.
Límite conocido: los textos escritos en el panel (frase principal, descripción, equipamiento, condiciones) no se traducen solos.
Lógica pura verificada: 73/73.

## Selector propio de fecha y hora — escrito, SIN EJECUTAR
`src/components/ui/DateTimePicker.tsx` y `DateRangeFields.tsx` reemplazan todos los `<input type="date|datetime-local">` (web pública y panel). Calendario mensual con hoy resaltado y días bloqueados, hora por botones (1-12, minutos 00/15/30/45, AM/PM), atajos +1 día/+3 días/+1 semana, teclado (flechas, Escape), ES/EN. El valor que viaja al servidor conserva el formato `YYYY-MM-DDTHH:mm`, así que el servidor no cambió.
Lógica pura verificada: 82/82.
