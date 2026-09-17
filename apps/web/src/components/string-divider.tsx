/**
 * Three parallel hairlines standing in for taut strings — used under page
 * titles as a section divider that still does a divider's actual job.
 */
export function StringDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-[3px] ${className}`} aria-hidden="true">
      <div className="h-px w-full bg-sky" />
      <div className="h-px w-2/3 bg-sky" />
      <div className="h-px w-1/3 bg-sky" />
    </div>
  );
}
