export type Lang = "es" | "en";
export const resolveLang = (v?: string | null): Lang => (v === "en" ? "en" : "es");

const es = {
  "site.soonTitle": "Sitio en construcción", "site.soonSub": "Vuelve pronto.",
  "nav.vehicles": "Vehículos", "nav.terms": "Condiciones",
  "a11y.theme": "Cambiar entre modo claro y oscuro", "a11y.lang": "Cambiar el idioma a inglés", "a11y.waFab": "Escribir por WhatsApp",
  "wa.hello": "Hola, quisiera información sobre el alquiler de un vehículo.",
  "footer.contact": "Contacto", "footer.zones": "Zonas de entrega", "footer.phoneTbd": "Teléfono por confirmar",
  "footer.addressTbd": "Dirección por confirmar", "footer.zonesTbd": "Por confirmar",
  "home.heroDefault": "Alquila tu vehículo en Santo Domingo",
  "home.heroSub": "Elige el vehículo, indica tus fechas y envía tu solicitud. Te confirmamos la disponibilidad lo antes posible.",
  "home.waBtn": "Escribir por WhatsApp", "home.checkTitle": "Consulta disponibilidad", "home.pickup": "Recogida", "home.return": "Devolución",
  "home.checkBtn": "Ver vehículos disponibles", "home.ourVehicles": "Nuestros vehículos", "home.viewAll": "Ver todos",
  "home.soonVehicles": "Pronto publicaremos nuestros vehículos.", "home.howTitle": "Así de simple",
  "home.step1t": "Elige tus fechas", "home.step1d": "Consulta qué vehículos están libres.",
  "home.step2t": "Envía tu solicitud", "home.step2d": "Sin crear cuenta: solo tus datos de contacto.",
  "home.step3t": "Te confirmamos", "home.step3d": "Revisamos y te contactamos para confirmar la reserva.",
  "home.faqTitle": "Preguntas frecuentes",
  "faq.q1": "¿Mi solicitud ya es una reserva?", "faq.a1": "No. Queda pendiente de revisión y la reserva se confirma cuando te contactamos.",
  "faq.q2": "¿Necesito crear una cuenta?", "faq.a2": "No. Solo necesitamos tu nombre y un teléfono o WhatsApp.",
  "faq.q3": "¿Dónde entregan el vehículo?", "faq.a3": "Entregamos en: {zones}.", "faq.a3none": "Las zonas de entrega se confirman al contactarte.",
  "home.locTitle": "Ubicación y entrega", "home.addrTbd": "Dirección por confirmar.", "home.termsLink": "Condiciones generales de alquiler",
  "cat.title": "Vehículos", "cat.subFiltered": "Disponibles del {from} al {to}", "cat.subPrompt": "Elige fechas para ver la disponibilidad.",
  "cat.check": "Consultar", "cat.noneFiltered": "No hay vehículos disponibles en esas fechas. Prueba con otras o escríbenos por WhatsApp.",
  "cat.none": "Pronto publicaremos nuestros vehículos.", "cat.badDates": "Revisa las fechas: la devolución debe ser posterior a la recogida.",
  "cat.fAll": "Todos", "cat.fAuto": "Automática", "cat.fSeats5": "5+ asientos", "cat.sort": "Ordenar",
  "cat.sortDefault": "Recomendado", "cat.sortAsc": "Precio: menor a mayor", "cat.sortDesc": "Precio: mayor a menor",
  "cat.count": "{n} vehículo(s)", "cat.noMatch": "Ningún vehículo cumple estos filtros.",
  "veh.perDay": "día", "veh.request": "Solicitar", "veh.details": "Ver detalles", "veh.photoSoon": "Foto próximamente",
  "veh.seats": "{n} asientos", "veh.automatic": "Automática", "veh.manual": "Manual", "veh.features": "Equipamiento",
  "veh.back": "Volver al catálogo", "veh.specs": "Características", "veh.requestThis": "Solicitar este vehículo", "veh.notFound": "Este vehículo no está disponible.",
  "req.title": "Solicitar reserva", "req.subtitle": "Tu solicitud queda pendiente de revisión: no es una reserva confirmada hasta que te contactemos.",
  "req.vehicleDates": "Vehículo y fechas", "req.vehicle": "Vehículo", "req.select": "Selecciona…", "req.pickup": "Recogida", "req.return": "Devolución",
  "req.pickupLoc": "Lugar de entrega", "req.returnLoc": "Lugar de devolución", "req.pickupLocPh": "Ej: Aeropuerto Las Américas",
  "req.yourData": "Tus datos", "req.name": "Nombre completo", "req.phone": "Teléfono / WhatsApp", "req.email": "Correo", "req.message": "Mensaje (opcional)",
  "req.noDocs": "No pedimos documentos en este paso. Usaremos tus datos solo para atender esta solicitud.", "req.submit": "Enviar solicitud",
  "req.noVehicles": "No hay vehículos disponibles para esas fechas.", "req.changeDates": "Cambiar fechas",
  "req.estimate": "Estimado", "req.days": "{n} día(s) facturable(s)", "req.estTotal": "Total estimado", "req.pickDates": "Elige vehículo y fechas para ver el estimado.",
  "req.estNote": "Es un estimado. El importe final lo confirmamos al revisar tu solicitud.", "req.error": "Revisa tus datos e inténtalo de nuevo.",
  "thx.title": "Solicitud recibida", "thx.yourCode": "Tu código es", "thx.pending": "Tu solicitud está pendiente de revisión. Todavía no es una reserva confirmada: te contactaremos para confirmarla.",
  "thx.wa": "Escribirnos por WhatsApp", "thx.waNote": "Esto solo abre WhatsApp con un mensaje escrito; no se envía solo.", "thx.home": "Volver al inicio",
  "thx.waText": "Hola, envié la solicitud {code}{vehicle}{dates}. Quedo atento(a) a la confirmación.", "thx.waTextNoCode": "Hola, envié una solicitud de reserva desde la web.",
  "thx.forVehicle": " para el {vehicle}", "thx.dates": " del {from} al {to}",
  "terms.title": "Condiciones generales de alquiler", "terms.soon": "Las condiciones generales se publicarán próximamente. Consulta con nosotros antes de reservar.",
} as const;

export type Key = keyof typeof es;

const en: Record<Key, string> = {
  "site.soonTitle": "Site under construction", "site.soonSub": "Please come back soon.",
  "nav.vehicles": "Vehicles", "nav.terms": "Terms",
  "a11y.theme": "Switch between light and dark mode", "a11y.lang": "Switch language to Spanish", "a11y.waFab": "Chat on WhatsApp",
  "wa.hello": "Hi, I'd like information about renting a vehicle.",
  "footer.contact": "Contact", "footer.zones": "Delivery areas", "footer.phoneTbd": "Phone to be confirmed",
  "footer.addressTbd": "Address to be confirmed", "footer.zonesTbd": "To be confirmed",
  "home.heroDefault": "Rent your vehicle in Santo Domingo",
  "home.heroSub": "Choose a vehicle, pick your dates and send your request. We'll confirm availability as soon as possible.",
  "home.waBtn": "Message us on WhatsApp", "home.checkTitle": "Check availability", "home.pickup": "Pick-up", "home.return": "Return",
  "home.checkBtn": "See available vehicles", "home.ourVehicles": "Our vehicles", "home.viewAll": "View all",
  "home.soonVehicles": "We will publish our vehicles soon.", "home.howTitle": "How it works",
  "home.step1t": "Pick your dates", "home.step1d": "See which vehicles are free.",
  "home.step2t": "Send your request", "home.step2d": "No account needed: just your contact details.",
  "home.step3t": "We confirm", "home.step3d": "We review it and contact you to confirm the booking.",
  "home.faqTitle": "Frequently asked questions",
  "faq.q1": "Is my request already a booking?", "faq.a1": "No. It stays pending review and the booking is confirmed once we contact you.",
  "faq.q2": "Do I need to create an account?", "faq.a2": "No. We only need your name and a phone or WhatsApp number.",
  "faq.q3": "Where do you deliver the vehicle?", "faq.a3": "We deliver in: {zones}.", "faq.a3none": "Delivery areas are confirmed when we contact you.",
  "home.locTitle": "Location and delivery", "home.addrTbd": "Address to be confirmed.", "home.termsLink": "General rental conditions",
  "cat.title": "Vehicles", "cat.subFiltered": "Available from {from} to {to}", "cat.subPrompt": "Pick dates to see availability.",
  "cat.check": "Check", "cat.noneFiltered": "No vehicles are available on those dates. Try other dates or message us on WhatsApp.",
  "cat.none": "We will publish our vehicles soon.", "cat.badDates": "Check the dates: the return must be after the pick-up.",
  "cat.fAll": "All", "cat.fAuto": "Automatic", "cat.fSeats5": "5+ seats", "cat.sort": "Sort",
  "cat.sortDefault": "Recommended", "cat.sortAsc": "Price: low to high", "cat.sortDesc": "Price: high to low",
  "cat.count": "{n} vehicle(s)", "cat.noMatch": "No vehicle matches these filters.",
  "veh.perDay": "day", "veh.request": "Request", "veh.details": "View details", "veh.photoSoon": "Photo coming soon",
  "veh.seats": "{n} seats", "veh.automatic": "Automatic", "veh.manual": "Manual", "veh.features": "Features",
  "veh.back": "Back to catalog", "veh.specs": "Specs", "veh.requestThis": "Request this vehicle", "veh.notFound": "This vehicle is not available.",
  "req.title": "Request a booking", "req.subtitle": "Your request stays pending review: it is not a confirmed booking until we contact you.",
  "req.vehicleDates": "Vehicle and dates", "req.vehicle": "Vehicle", "req.select": "Select…", "req.pickup": "Pick-up", "req.return": "Return",
  "req.pickupLoc": "Delivery location", "req.returnLoc": "Return location", "req.pickupLocPh": "E.g. Las Américas Airport",
  "req.yourData": "Your details", "req.name": "Full name", "req.phone": "Phone / WhatsApp", "req.email": "Email", "req.message": "Message (optional)",
  "req.noDocs": "We don't ask for documents at this step. We'll only use your details to handle this request.", "req.submit": "Send request",
  "req.noVehicles": "No vehicles are available for those dates.", "req.changeDates": "Change dates",
  "req.estimate": "Estimate", "req.days": "{n} billable day(s)", "req.estTotal": "Estimated total", "req.pickDates": "Choose a vehicle and dates to see the estimate.",
  "req.estNote": "This is an estimate. We confirm the final amount when we review your request.", "req.error": "Please check your details and try again.",
  "thx.title": "Request received", "thx.yourCode": "Your code is", "thx.pending": "Your request is pending review. It is not a confirmed booking yet: we will contact you to confirm it.",
  "thx.wa": "Message us on WhatsApp", "thx.waNote": "This only opens WhatsApp with a written message; it is not sent automatically.", "thx.home": "Back to home",
  "thx.waText": "Hi, I sent request {code}{vehicle}{dates}. I look forward to your confirmation.", "thx.waTextNoCode": "Hi, I sent a booking request from the website.",
  "thx.forVehicle": " for the {vehicle}", "thx.dates": " from {from} to {to}",
  "terms.title": "General rental conditions", "terms.soon": "The general conditions will be published soon. Please ask us before booking.",
};

export const DICT: Record<Lang, Record<Key, string>> = { es, en };

export function fmt(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}
export const t = (lang: Lang, key: Key, vars?: Record<string, string | number>) => fmt(DICT[lang][key], vars);

/** Subconjunto del diccionario (por prefijo) para pasar a componentes de cliente. */
export function labelsFor(lang: Lang, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(DICT[lang]).filter(([k]) => k.startsWith(prefix)));
}
