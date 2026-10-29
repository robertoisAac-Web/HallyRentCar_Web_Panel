export function WhatsAppFab({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.500l1.700-5.400A8.400 8.400 0 1 1 21 11.500Z" /><path d="M9 9.500c.3 2 2.200 4 4.500 4.500l1.200-1.200-1.800-1-.8.700c-.8-.4-1.500-1.100-1.900-1.900l.7-.8-1-1.800Z" /></svg>
    </a>
  );
}
