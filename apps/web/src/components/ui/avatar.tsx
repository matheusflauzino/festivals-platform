export function Avatar({ name, className = 'h-9 w-9' }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
