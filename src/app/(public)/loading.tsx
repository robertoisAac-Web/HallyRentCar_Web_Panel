export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-10" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-[var(--color-line)]" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-[var(--color-line)]" />)}</div>
    </div>
  );
}
