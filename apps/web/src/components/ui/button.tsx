import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-viola text-white hover:bg-viola-strong focus-visible:outline-viola disabled:hover:bg-viola',
  secondary:
    'border border-sky bg-white text-ink hover:bg-mist focus-visible:outline-viola disabled:hover:bg-white',
  danger:
    'bg-status-closed-fg text-white hover:opacity-90 focus-visible:outline-status-closed-fg',
};

export function buttonStyles(variant: ButtonVariant = 'primary', className = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonStyles(variant, className)} {...props} />;
}
