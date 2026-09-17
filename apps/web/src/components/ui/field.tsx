import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-sm font-medium text-ink" {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`rounded-lg border border-sky bg-white px-3 py-2 text-sm text-ink placeholder:text-graphite/60 focus:border-viola focus:outline focus:outline-2 focus:outline-orchid/50 ${className}`}
        {...props}
      />
    );
  },
);

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-sm text-status-closed-fg">{children}</p>;
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}
