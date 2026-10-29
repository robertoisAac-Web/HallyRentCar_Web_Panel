import Link from "next/link";

/** Pestañas por enlace (sin JavaScript): cada una es una dirección con ?tab=. */
export function Tabs({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav aria-label="Secciones" className="tabs">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={`tab ${i.key === active ? "is-active" : ""}`} aria-current={i.key === active ? "page" : undefined}>{i.label}</Link>))}
    </nav>
  );
}
