/**
 * The concentric arcs echo a viola caipira's rosette (the sound hole
 * around the strings) — the one deliberately warm (cedar-toned) accent
 * in the whole system, reserved for the brand mark only.
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="20" cy="20" r="19" stroke="var(--color-accent)" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="13" stroke="var(--color-brand)" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="7" stroke="var(--color-accent)" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="2" fill="var(--color-brand)" />
    </svg>
  );
}

export function BrandWordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BrandMark className="h-8 w-8 shrink-0" />
      <span className="text-lg font-semibold tracking-tight text-text">FENAC</span>
    </div>
  );
}
