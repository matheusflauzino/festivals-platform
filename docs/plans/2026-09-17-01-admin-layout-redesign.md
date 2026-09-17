# Admin Layout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin frontend's visual/navigation foundation (sidebar, header, dark mode, data tables, modals/form modals) to a professional dashboard standard, with a full nav tree and a reusable component library, while keeping every existing behavior/test intact.

**Architecture:** A token-driven Tailwind v4 design system (light+dark) under `app/globals.css`; a `src/components/layout/*` shell (Sidebar, Header, AppShell, CommandPalette, theme system) composed with a `src/components/ui/*` component library (Modal, FormModal, DataTable, Card, Badge, etc.); existing pages are restyled in place, and three creation flows (stage, grade criterion, plus a brand-new festival edit flow) move from full pages to `FormModal`s.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript, Vitest + Testing Library, react-hook-form + zod (`@fenac-platform/contracts`), TanStack Query. No new npm dependencies — icons are hand-drawn inline SVGs.

**Spec:** `docs/specs/2026-09-17-admin-layout-redesign-design.md` (and the still-valid auth/error/testing sections of `docs/specs/2026-09-16-frontend-admin-design.md`).

## Global Constraints

- All new/changed UI text is Portuguese (pt-BR), matching the existing app.
- No new npm dependencies (icons are hand-rolled SVG components, not a library).
- Every existing passing test must still pass unless this plan explicitly says a file moved (then the test moves with it, same assertions).
- `festival-list.spec.tsx` and the e2e flow require `screen.getByText('DRAFT')` / `getByText('OPEN')` verbatim — status badges must keep showing the raw `FestivalStatus` string, never a localized label.
- `admin-festival-flow.spec.ts` (e2e) requires clicking "Novo Festival" to navigate to `/festivals/new` — that route and its full-page form stay.
- All commands below assume `cd apps/web` first (run from repo root: `cd apps/web`).

---

## Task 1: Design tokens, dark mode, and typography

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind utility classes consumed by every later task: `bg-canvas`, `bg-surface`, `bg-surface-muted`, `border-border`, `text-text`, `text-text-muted`, `text-text-subtle`, `bg-brand`/`text-brand`/`border-brand`, `bg-brand-strong`, `bg-brand-soft`/`text-brand`, `text-accent`, `bg-status-{draft,open,closed,warning}-bg`/`text-status-{...}-fg`. Dark mode toggles via a `.dark` class on `<html>`.

- [ ] **Step 1: Replace the token system in `globals.css`**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --color-canvas: #f9fafb;
  --color-surface: #ffffff;
  --color-surface-muted: #f3f4f6;
  --color-border: #e5e7eb;
  --color-text: #1f1b2c;
  --color-text-muted: #6b6478;
  --color-text-subtle: #9ca3af;
  --color-brand: #7d4fd1;
  --color-brand-strong: #6a3db8;
  --color-brand-soft: #f1ebfc;
  --color-accent: #c97b4a;

  --color-status-draft-bg: #ece9f7;
  --color-status-draft-fg: #5c5570;
  --color-status-open-bg: #dcf5ec;
  --color-status-open-fg: #16805f;
  --color-status-closed-bg: #fbe7ee;
  --color-status-closed-fg: #a23a5c;
  --color-status-warning-bg: #fef3e2;
  --color-status-warning-fg: #b45309;
}

.dark {
  --color-canvas: #14121f;
  --color-surface: #1c1930;
  --color-surface-muted: #241f3d;
  --color-border: #322c4d;
  --color-text: #f1eefb;
  --color-text-muted: #a79fc2;
  --color-text-subtle: #746c93;
  --color-brand: #a78bfa;
  --color-brand-strong: #c4b2ff;
  --color-brand-soft: #2e2650;
  --color-accent: #e08f5e;

  --color-status-draft-bg: #2c2745;
  --color-status-draft-fg: #c9c2e8;
  --color-status-open-bg: #113b2e;
  --color-status-open-fg: #6ee7b7;
  --color-status-closed-bg: #3d1f2c;
  --color-status-closed-fg: #f4a6c1;
  --color-status-warning-bg: #3d2a12;
  --color-status-warning-fg: #fbbf6b;
}

@theme inline {
  --color-canvas: var(--color-canvas);
  --color-surface: var(--color-surface);
  --color-surface-muted: var(--color-surface-muted);
  --color-border: var(--color-border);
  --color-text: var(--color-text);
  --color-text-muted: var(--color-text-muted);
  --color-text-subtle: var(--color-text-subtle);
  --color-brand: var(--color-brand);
  --color-brand-strong: var(--color-brand-strong);
  --color-brand-soft: var(--color-brand-soft);
  --color-accent: var(--color-accent);
  --color-status-draft-bg: var(--color-status-draft-bg);
  --color-status-draft-fg: var(--color-status-draft-fg);
  --color-status-open-bg: var(--color-status-open-bg);
  --color-status-open-fg: var(--color-status-open-fg);
  --color-status-closed-bg: var(--color-status-closed-bg);
  --color-status-closed-fg: var(--color-status-closed-fg);
  --color-status-warning-bg: var(--color-status-warning-bg);
  --color-status-warning-fg: var(--color-status-warning-fg);
  --font-sans: var(--font-manrope);
}

body {
  background: var(--color-canvas);
  color: var(--color-text);
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
}
```

This is a full replacement of the file's previous content (drop `--color-mist`/`sky`/`periwinkle`/`orchid`/`viola`/`viola-strong`/`ink`/`graphite`/`cedar`/`--font-display`/`--background`/`--foreground` — every consumer of those is rewritten in later tasks of this plan).

- [ ] **Step 2: Drop the Fraunces font and add the theme-init script in `layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FENAC — Área Administrativa",
  description: "Painel administrativo do Festival Nacional da Canção",
};

const THEME_INIT_SCRIPT = `(function(){try{var stored=localStorage.getItem('fenac-theme');var isDark=stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',isDark);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-text">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify nothing crashes**

Run: `cd apps/web && pnpm test`
Expected: same pass/fail counts as before this task (no test asserts on Tailwind class names, so renamed tokens don't break anything yet — pages will look broken until later tasks restyle them, which is expected mid-plan).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat(web): replace design tokens with a dark-mode-capable semantic system"
```

---

## Task 2: `Modal` and `ConfirmModal` primitives

**Files:**
- Create: `apps/web/src/components/ui/icons.tsx`
- Create: `apps/web/src/components/ui/modal.tsx`
- Create: `apps/web/src/components/ui/confirm-modal.tsx`
- Test: `apps/web/src/components/ui/modal.spec.tsx`

**Interfaces:**
- Produces: `Modal({ open, onOpenChange, title, description?, children, className? })`; `ConfirmModal({ open, onOpenChange, title, description?, confirmLabel?, cancelLabel?, confirmVariant?, isConfirming?, onConfirm })`. Icons: `CloseIcon` (used here) plus the full icon set other tasks import from `./icons`.

- [ ] **Step 1: Create the icon set**

```tsx
// apps/web/src/components/ui/icons.tsx
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function createIcon(children: ReactNode) {
  return function IconComponent({ className = 'h-5 w-5', ...props }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const MenuIcon = createIcon(
  <>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </>,
);
export const CloseIcon = createIcon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>,
);
export const ChevronDownIcon = createIcon(<polyline points="6 9 12 15 18 9" />);
export const ChevronLeftIcon = createIcon(<polyline points="15 18 9 12 15 6" />);
export const ChevronRightIcon = createIcon(<polyline points="9 18 15 12 9 6" />);
export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>,
);
export const MoonIcon = createIcon(<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />);
export const SunIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </>,
);
export const BellIcon = createIcon(
  <>
    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9z" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </>,
);
export const PlusIcon = createIcon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);
export const PencilIcon = createIcon(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </>,
);
export const LogOutIcon = createIcon(
  <>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>,
);
export const GridIcon = createIcon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);
export const CalendarIcon = createIcon(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" />
    <line x1="16" y1="2.5" x2="16" y2="6.5" />
  </>,
);
export const AwardIcon = createIcon(
  <>
    <circle cx="12" cy="8" r="5" />
    <polyline points="8.5 12.5 7 21 12 18 17 21 15.5 12.5" />
  </>,
);
export const StarIcon = createIcon(
  <polygon points="12 2.5 15 9.5 22 10.2 16.8 15 18.2 22 12 18.3 5.8 22 7.2 15 2 10.2 9 9.5" />,
);
export const MusicIcon = createIcon(
  <>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </>,
);
export const ClipboardIcon = createIcon(
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <rect x="8.5" y="2" width="7" height="4" rx="1" />
  </>,
);
export const TrendingUpIcon = createIcon(
  <>
    <polyline points="3 17 9 11 13 15 21 6" />
    <polyline points="15 6 21 6 21 12" />
  </>,
);
export const FileTextIcon = createIcon(
  <>
    <path d="M6 3h9l4 4v14H6z" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </>,
);
export const MailIcon = createIcon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3 7 12 13 21 7" />
  </>,
);
export const UsersIcon = createIcon(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0111 0" />
    <circle cx="17.5" cy="9.5" r="2.6" />
    <path d="M15.7 13.2a4.5 4.5 0 015.3 4.4" />
  </>,
);
export const DatabaseIcon = createIcon(
  <>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5V18c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.5" />
    <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </>,
);
```

- [ ] **Step 2: Write the failing test for `Modal`**

```tsx
// apps/web/src/components/ui/modal.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onOpenChange={vi.fn()} title="Título">
        conteúdo
      </Modal>,
    );
    expect(screen.queryByText('conteúdo')).toBeNull();
  });

  it('renders the title, description and children when open', () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Título" description="Descrição">
        conteúdo
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Título')).toBeDefined();
    expect(screen.getByText('Descrição')).toBeDefined();
    expect(screen.getByText('conteúdo')).toBeDefined();
  });

  it('calls onOpenChange(false) when the close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Título">
        conteúdo
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Escape is pressed', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Título">
        conteúdo
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when the backdrop is clicked', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Modal open onOpenChange={onOpenChange} title="Título">
        conteúdo
      </Modal>,
    );
    const backdrop = container.querySelector('[data-testid="modal-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/modal.spec.tsx`
Expected: FAIL — `Cannot find module './modal'`.

- [ ] **Step 4: Implement `Modal`**

```tsx
// apps/web/src/components/ui/modal.tsx
'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, title, description, children, className = '' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        data-testid="modal-backdrop"
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl ${className}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-text">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/modal.spec.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Implement `ConfirmModal` (no separate test — exercised end-to-end in Task 21)**

```tsx
// apps/web/src/components/ui/confirm-modal.tsx
'use client';

import { Modal } from './modal';
import { Button, type ButtonVariant } from './button';

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  isConfirming?: boolean;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  isConfirming = false,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={confirmVariant} loading={isConfirming} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
```

This imports `Button`/`ButtonVariant` from `./button`, which Task 3 (the very next task) extends with a `variant`/`loading` API — `loading` doesn't exist on `Button` until Task 3 runs, so `tsc`/build would fail on this file alone if checked in isolation; that's expected for the one-task gap between Task 2 and Task 3 (Vitest for already-written specs still passes since it only type-checks via `esbuild` transpile, not full `tsc`).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui/icons.tsx apps/web/src/components/ui/modal.tsx apps/web/src/components/ui/modal.spec.tsx apps/web/src/components/ui/confirm-modal.tsx
git commit -m "feat(web): add Modal and ConfirmModal primitives"
```

---

## Task 3: Extend `Button` and `Field` (variants, sizes, loading, Select/Textarea)

Moved earlier (was Task 13) because `ConfirmModal` (Task 2) and every later task already depend on the extended `Button`/`Field` API.

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/field.tsx`
- Test: `apps/web/src/components/ui/button.spec.tsx`

**Interfaces:**
- Produces: `buttonStyles(variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md', className?)`; `Button` (adds `size`, `loading` props, keeps `variant`/`className`/native button props); `Label`, `Input`, `Textarea`, `Select`, `FieldError`, `Field` (all from `./field`).

- [ ] **Step 1: Write the failing test for `Button`**

```tsx
// apps/web/src/components/ui/button.spec.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('disables the button and shows a spinner when loading', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toHaveProperty('disabled', true);
  });

  it('is not disabled by default', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveProperty('disabled', false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/button.spec.tsx`
Expected: FAIL — loading button is not disabled yet (current `Button` has no `loading` prop).

- [ ] **Step 3: Rewrite `button.tsx`**

```tsx
// apps/web/src/components/ui/button.tsx
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong focus-visible:outline-brand disabled:hover:bg-brand',
  secondary:
    'border border-border bg-surface text-text hover:bg-surface-muted focus-visible:outline-brand disabled:hover:bg-surface',
  ghost: 'text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-brand',
  danger: 'bg-status-closed-fg text-white hover:opacity-90 focus-visible:outline-status-closed-fg',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function buttonStyles(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button className={buttonStyles(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
```

`buttonStyles('secondary')` (used by existing pages) keeps working unchanged: `size` defaults to `'md'`.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/button.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Rewrite `field.tsx`**

```tsx
// apps/web/src/components/ui/field.tsx
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-sm font-medium text-text" {...props} />;
}

const controlStyles =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline focus:outline-2 focus:outline-brand-soft disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${controlStyles} ${className}`} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`${controlStyles} ${className}`} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', ...props }, ref) {
    return <select ref={ref} className={`${controlStyles} ${className}`} {...props} />;
  },
);

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-sm text-status-closed-fg">{children}</p>;
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}
```

- [ ] **Step 6: Run the whole suite to confirm nothing else broke**

Run: `cd apps/web && pnpm test`
Expected: same results as after Task 1 (forms still render inputs the same way; only visual classes changed).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui/button.tsx apps/web/src/components/ui/button.spec.tsx apps/web/src/components/ui/field.tsx
git commit -m "feat(web): extend Button and Field with variants, loading state, Select/Textarea"
```

---

## Task 4: `FormModal`

**Files:**
- Create: `apps/web/src/components/ui/form-modal.tsx`
- Test: `apps/web/src/components/ui/form-modal.spec.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 2), `Button` (Task 3).
- Produces: `FormModal({ open, onOpenChange, title, description?, onSubmit, isSubmitting?, submitLabel?, cancelLabel?, children })` — renders a `<form>` wrapping `children` with a standardized Cancel/Save footer.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/ui/form-modal.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormModal } from './form-modal';

describe('FormModal', () => {
  it('calls onSubmit when the form is submitted', () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <FormModal open onOpenChange={vi.fn()} title="Novo Item" onSubmit={onSubmit} submitLabel="Criar">
        <input aria-label="Nome" />
      </FormModal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('calls onOpenChange(false) when Cancelar is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <FormModal open onOpenChange={onOpenChange} title="Novo Item" onSubmit={vi.fn()}>
        <input aria-label="Nome" />
      </FormModal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables the submit button while isSubmitting', () => {
    render(
      <FormModal open onOpenChange={vi.fn()} title="Novo Item" onSubmit={vi.fn()} isSubmitting submitLabel="Criar">
        <input aria-label="Nome" />
      </FormModal>,
    );
    expect(screen.getByRole('button', { name: 'Criar' })).toHaveProperty('disabled', true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/form-modal.spec.tsx`
Expected: FAIL — `Cannot find module './form-modal'`.

- [ ] **Step 3: Implement `FormModal`**

```tsx
// apps/web/src/components/ui/form-modal.tsx
'use client';

import type { FormEvent, ReactNode } from 'react';
import { Modal } from './modal';
import { Button } from './button';

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  children,
}: FormModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {children}
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/form-modal.spec.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/form-modal.tsx apps/web/src/components/ui/form-modal.spec.tsx
git commit -m "feat(web): add FormModal primitive"
```

---

## Task 5: Theme system (`ThemeProvider` + `ThemeToggle`)

**Files:**
- Create: `apps/web/src/components/layout/theme-provider.tsx`
- Create: `apps/web/src/components/layout/theme-toggle.tsx`
- Modify: `apps/web/src/components/providers.tsx`
- Test: `apps/web/src/components/layout/theme-toggle.spec.tsx`

**Interfaces:**
- Produces: `ThemeProvider`, `useTheme(): { theme: 'light'|'dark', toggleTheme: () => void }`, `ThemeToggle` (a button using `useTheme`).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/layout/theme-toggle.spec.tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from './theme-provider';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('toggles the dark class on <html> and persists the choice', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole('button', { name: 'Ativar tema escuro' });
    fireEvent.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('fenac-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('fenac-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/layout/theme-toggle.spec.tsx`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `ThemeProvider`**

```tsx
// apps/web/src/components/layout/theme-provider.tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'fenac-theme';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage failures (private browsing, disabled storage)
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

- [ ] **Step 4: Implement `ThemeToggle`**

```tsx
// apps/web/src/components/layout/theme-toggle.tsx
'use client';

import { useTheme } from './theme-provider';
import { MoonIcon, SunIcon } from '../ui/icons';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className="rounded-lg p-2 text-text-muted hover:bg-surface-muted hover:text-text"
    >
      {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/layout/theme-toggle.spec.tsx`
Expected: PASS.

- [ ] **Step 6: Wire `ThemeProvider` into the app-wide `Providers`**

```tsx
// apps/web/src/components/providers.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth/auth-context';
import { ThemeProvider } from './layout/theme-provider';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Run the whole suite**

Run: `cd apps/web && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/layout/theme-provider.tsx apps/web/src/components/layout/theme-toggle.tsx apps/web/src/components/layout/theme-toggle.spec.tsx apps/web/src/components/providers.tsx
git commit -m "feat(web): add light/dark theme provider and toggle"
```

---

## Task 6: `DropdownMenu` and `Avatar`

**Files:**
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/avatar.tsx`
- Test: `apps/web/src/components/ui/dropdown-menu.spec.tsx`

**Interfaces:**
- Produces: `DropdownMenu({ trigger, children, align? })`, `DropdownItem` (a `<button role="menuitem">`), `Avatar({ name, className? })`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/ui/dropdown-menu.spec.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu, DropdownItem } from './dropdown-menu';

describe('DropdownMenu', () => {
  it('opens on trigger click and closes when an item is clicked', () => {
    render(
      <DropdownMenu trigger={<span>Abrir</span>}>
        <DropdownItem>Sair</DropdownItem>
      </DropdownMenu>,
    );

    expect(screen.queryByText('Sair')).toBeNull();
    fireEvent.click(screen.getByText('Abrir'));
    expect(screen.getByText('Sair')).toBeDefined();
    fireEvent.click(screen.getByText('Sair'));
    expect(screen.queryByText('Sair')).toBeNull();
  });

  it('closes when Escape is pressed', () => {
    render(
      <DropdownMenu trigger={<span>Abrir</span>}>
        <DropdownItem>Sair</DropdownItem>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByText('Abrir'));
    expect(screen.getByText('Sair')).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Sair')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/dropdown-menu.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `DropdownMenu`**

```tsx
// apps/web/src/components/ui/dropdown-menu.tsx
'use client';

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, children, align = 'right' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={`absolute z-40 mt-2 min-w-[200px] rounded-xl border border-border bg-surface p-1.5 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-surface-muted ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/dropdown-menu.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `Avatar` (no dedicated test — trivial, exercised via Header in Task 9)**

```tsx
// apps/web/src/components/ui/avatar.tsx
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
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/dropdown-menu.tsx apps/web/src/components/ui/dropdown-menu.spec.tsx apps/web/src/components/ui/avatar.tsx
git commit -m "feat(web): add DropdownMenu and Avatar primitives"
```

---

## Task 7: Sidebar nav tree, `Sidebar`, `SidebarProvider`

**Files:**
- Create: `apps/web/src/components/layout/sidebar-nav-data.ts`
- Create: `apps/web/src/components/layout/sidebar-context.tsx`
- Create: `apps/web/src/components/layout/sidebar.tsx`
- Test: `apps/web/src/components/layout/sidebar.spec.tsx`

**Interfaces:**
- Produces: `NAV_GROUPS: NavGroup[]`, `ACTIVE_NAV_ITEMS: NavItem[]` (from `sidebar-nav-data.ts`); `SidebarProvider`, `useSidebar(): { collapsed, toggleCollapsed, mobileOpen, setMobileOpen }`; `Sidebar` (reads `usePathname()`).

- [ ] **Step 1: Create the nav data**

```ts
// apps/web/src/components/layout/sidebar-nav-data.ts
import type { ComponentType, SVGProps } from 'react';
import {
  GridIcon,
  CalendarIcon,
  AwardIcon,
  StarIcon,
  MusicIcon,
  ClipboardIcon,
  TrendingUpIcon,
  FileTextIcon,
  MailIcon,
  UsersIcon,
  DatabaseIcon,
} from '../ui/icons';

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  status: 'active' | 'soon';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Visão Geral',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: GridIcon, status: 'active' }],
  },
  {
    label: 'Cadastros',
    items: [
      { label: 'Festivais', href: '/festivals', icon: CalendarIcon, status: 'active' },
      { label: 'Premiações', href: '/premiacoes', icon: AwardIcon, status: 'soon' },
      { label: 'Critérios de Nota', href: '/criterios-de-nota', icon: StarIcon, status: 'soon' },
      { label: 'Instrumentos', href: '/instrumentos', icon: MusicIcon, status: 'soon' },
    ],
  },
  {
    label: 'Inscrições & Avaliação',
    items: [
      { label: 'Inscrições', href: '/inscricoes', icon: ClipboardIcon, status: 'soon' },
      { label: 'Classificação', href: '/classificacao', icon: TrendingUpIcon, status: 'soon' },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { label: 'Relatório de Inscrições', href: '/relatorios/inscricoes', icon: FileTextIcon, status: 'soon' },
      {
        label: 'Resultado da Votação Online',
        href: '/relatorios/votacao-online',
        icon: TrendingUpIcon,
        status: 'soon',
      },
      { label: 'Mala Direta', href: '/relatorios/mala-direta', icon: MailIcon, status: 'soon' },
      { label: 'Ficha de Inscrição', href: '/relatorios/ficha-de-inscricao', icon: FileTextIcon, status: 'soon' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Usuários', href: '/usuarios', icon: UsersIcon, status: 'soon' },
      { label: 'Backups', href: '/backups', icon: DatabaseIcon, status: 'soon' },
    ],
  },
];

export const ACTIVE_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items).filter(
  (item) => item.status === 'active',
);
```

- [ ] **Step 2: Create `SidebarProvider`**

```tsx
// apps/web/src/components/layout/sidebar-context.tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);
const STORAGE_KEY = 'fenac-sidebar-collapsed';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      // ignore storage failures
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
```

- [ ] **Step 3: Write the failing test for `Sidebar`**

```tsx
// apps/web/src/components/layout/sidebar.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './sidebar';
import { SidebarProvider } from './sidebar-context';

vi.mock('next/navigation', () => ({ usePathname: () => '/festivals' }));

describe('Sidebar', () => {
  it('marks the current active item with aria-current and renders soon items as disabled', () => {
    render(
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>,
    );

    const festivaisLink = screen.getByRole('link', { name: /Festivais/ });
    expect(festivaisLink.getAttribute('aria-current')).toBe('page');

    expect(screen.queryByRole('link', { name: /Premiações/ })).toBeNull();
    expect(screen.getByText('Premiações')).toBeDefined();
    expect(screen.getAllByText('em breve').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/layout/sidebar.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 5: Implement `Sidebar`**

```tsx
// apps/web/src/components/layout/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from './sidebar-nav-data';
import { useSidebar } from './sidebar-context';
import { BrandMark, BrandWordmark } from '../brand-mark';
import { ChevronLeftIcon } from '../ui/icons';

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-border bg-surface transition-all duration-200 lg:static ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          {collapsed ? <BrandMark className="h-8 w-8" /> : <BrandWordmark />}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-text-subtle">
                  {group.label}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  if (item.status === 'soon') {
                    return (
                      <li key={item.label}>
                        <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-subtle">
                          <Icon className="h-5 w-5 shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1">{item.label}</span>
                              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px]">
                                em breve
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  }

                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-brand-soft text-brand'
                            : 'text-text-muted hover:bg-surface-muted hover:text-text'
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex shrink-0 items-center justify-center gap-2 border-t border-border py-3 text-sm text-text-muted hover:text-text"
        >
          <ChevronLeftIcon className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && 'Recolher'}
        </button>
      </aside>
    </>
  );
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/layout/sidebar.spec.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/layout/sidebar-nav-data.ts apps/web/src/components/layout/sidebar-context.tsx apps/web/src/components/layout/sidebar.tsx apps/web/src/components/layout/sidebar.spec.tsx
git commit -m "feat(web): add the full sidebar nav tree with active/soon items"
```

---

## Task 8: `CommandPalette`

**Files:**
- Create: `apps/web/src/components/layout/command-palette.tsx`
- Test: `apps/web/src/components/layout/command-palette.spec.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 2), `ACTIVE_NAV_ITEMS` (Task 7).
- Produces: `CommandPalette({ open, onOpenChange })`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/layout/command-palette.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './command-palette';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('CommandPalette', () => {
  it('filters active nav items by the typed query and navigates on click', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    expect(screen.getByText('Festivais')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Digite para buscar uma página…'), {
      target: { value: 'Festi' },
    });

    expect(screen.getByText('Festivais')).toBeDefined();
    expect(screen.queryByText('Dashboard')).toBeNull();

    fireEvent.click(screen.getByText('Festivais'));
    expect(mockPush).toHaveBeenCalledWith('/festivals');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an empty message when nothing matches', () => {
    render(<CommandPalette open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Digite para buscar uma página…'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Nenhuma página encontrada.')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/layout/command-palette.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `CommandPalette`**

```tsx
// apps/web/src/components/layout/command-palette.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../ui/modal';
import { ACTIVE_NAV_ITEMS } from './sidebar-nav-data';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const results = useMemo(
    () => ACTIVE_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  function goTo(href: string) {
    router.push(href);
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Buscar">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Digite para buscar uma página…"
        className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline-none"
      />
      <ul className="mt-3 flex flex-col gap-1">
        {results.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">Nenhuma página encontrada.</li>}
        {results.map((item) => (
          <li key={item.href}>
            <button
              type="button"
              onClick={() => goTo(item.href)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-surface-muted"
            >
              <item.icon className="h-4 w-4 text-text-muted" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/layout/command-palette.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/command-palette.tsx apps/web/src/components/layout/command-palette.spec.tsx
git commit -m "feat(web): add command palette for quick nav search"
```

---

## Task 9: `Header`

**Files:**
- Create: `apps/web/src/components/layout/header.tsx`
- Test: `apps/web/src/components/layout/header.spec.tsx`

**Interfaces:**
- Consumes: `useAuth` (existing), `useSidebar` (Task 7), `CommandPalette` (Task 8), `ThemeToggle` (Task 5), `DropdownMenu`/`DropdownItem`/`Avatar` (Task 6).
- Produces: `Header()` — no props; reads `admin`/`logout` from `useAuth()` directly.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/layout/header.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './header';
import { SidebarProvider } from './sidebar-context';
import { ThemeProvider } from './theme-provider';
import { useAuth } from '../../lib/auth/auth-context';

vi.mock('../../lib/auth/auth-context');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderHeader() {
  return render(
    <ThemeProvider>
      <SidebarProvider>
        <Header />
      </SidebarProvider>
    </ThemeProvider>,
  );
}

describe('Header', () => {
  it("shows the logged-in admin's name and role", () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token',
      login: vi.fn(),
      logout,
    });

    renderHeader();
    expect(screen.getByText('Ana')).toBeDefined();
    expect(screen.getByText('ORGANIZER')).toBeDefined();
  });

  it('calls logout when Sair is clicked from the user menu', () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token',
      login: vi.fn(),
      logout,
    });

    renderHeader();
    fireEvent.click(screen.getByText('Ana'));
    fireEvent.click(screen.getByText('Sair'));
    expect(logout).toHaveBeenCalled();
  });

  it('opens the command palette when the search button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token',
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/layout/header.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `Header`**

```tsx
// apps/web/src/components/layout/header.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/auth-context';
import { useSidebar } from './sidebar-context';
import { CommandPalette } from './command-palette';
import { ThemeToggle } from './theme-toggle';
import { DropdownMenu, DropdownItem } from '../ui/dropdown-menu';
import { Avatar } from '../ui/avatar';
import { MenuIcon, SearchIcon, BellIcon, LogOutIcon } from '../ui/icons';

export function Header() {
  const { admin, logout } = useAuth();
  const { setMobileOpen } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className="rounded-lg p-2 text-text-muted hover:bg-surface-muted lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text-subtle sm:flex"
        >
          <SearchIcon className="h-4 w-4" />
          Buscar
          <kbd className="ml-2 rounded border border-border px-1.5 py-0.5 text-[11px]">⌘K</kbd>
        </button>

        <ThemeToggle />

        <DropdownMenu
          trigger={
            <span className="relative rounded-lg p-2 text-text-muted hover:bg-surface-muted">
              <BellIcon className="h-5 w-5" />
            </span>
          }
        >
          <p className="px-3 py-2 text-sm text-text-muted">Nenhuma notificação por enquanto.</p>
        </DropdownMenu>

        <DropdownMenu
          trigger={
            <span className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-muted">
              <Avatar name={admin?.name ?? '?'} />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-text">{admin?.name}</span>
                <span className="block text-xs text-text-muted">{admin?.role}</span>
              </span>
            </span>
          }
        >
          <DropdownItem onClick={logout}>
            <LogOutIcon className="h-4 w-4" />
            Sair
          </DropdownItem>
        </DropdownMenu>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/layout/header.spec.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/header.tsx apps/web/src/components/layout/header.spec.tsx
git commit -m "feat(web): add app header with search, theme toggle, notifications and user menu"
```

---

## Task 10: `AppShell` — wire the new shell into the protected layout

**Files:**
- Create: `apps/web/src/components/layout/app-shell.tsx`
- Modify: `apps/web/app/(admin)/(protected)/layout.tsx`
- Delete: `apps/web/src/components/dashboard-shell.tsx`

**Interfaces:**
- Produces: `AppShell({ children })` — composes `SidebarProvider` + `Sidebar` + `Header` + `<main>`.

- [ ] **Step 1: Implement `AppShell`**

```tsx
// apps/web/src/components/layout/app-shell.tsx
'use client';

import type { ReactNode } from 'react';
import { SidebarProvider } from './sidebar-context';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Wire it into the protected layout**

```tsx
// apps/web/app/(admin)/(protected)/layout.tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/lib/auth/auth-context';
import { AppShell } from '../../../src/components/layout/app-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 3: Delete the old shell**

```bash
git rm apps/web/src/components/dashboard-shell.tsx
```

- [ ] **Step 4: Run `layout.spec.tsx` to confirm it still passes unmodified**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/layout.spec.tsx"`
Expected: PASS — it only asserts `screen.getByText('Ana')` and `screen.getByText('Festivais')`, both still rendered (by `Header` and `Sidebar` respectively).

- [ ] **Step 5: Run the whole suite**

Run: `cd apps/web && pnpm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/app-shell.tsx "apps/web/app/(admin)/(protected)/layout.tsx"
git commit -m "feat(web): replace DashboardShell with the new AppShell (sidebar + header)"
```

---

## Task 11: `Card`, `Badge` (+ `FestivalStatusBadge` refactor), `EmptyState`, `Skeleton`, `StatCard`

**Files:**
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/empty-state.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx`
- Create: `apps/web/src/components/ui/stat-card.tsx`
- Modify: `apps/web/src/components/festival-status-badge.tsx`
- Test: `apps/web/src/components/ui/badge.spec.tsx`

**Interfaces:**
- Produces: `Card`, `CardHeader`, `CardTitle`, `CardContent`; `Badge({ tone?, children })` with `BadgeTone = 'neutral'|'brand'|'success'|'warning'|'danger'`; `EmptyState({ title, description?, action? })`; `Skeleton({ className? })`; `StatCard({ label, value, icon? })`.
- `FestivalStatusBadge` keeps its exact existing behavior (renders the raw `status` string) — required by `festival-list.spec.tsx` and the e2e test (Global Constraints).

- [ ] **Step 1: Write the failing test for `Badge`**

```tsx
// apps/web/src/components/ui/badge.spec.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge tone="success">Aberto</Badge>);
    expect(screen.getByText('Aberto')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/badge.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `Badge`**

```tsx
// apps/web/src/components/ui/badge.tsx
import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-status-draft-bg text-status-draft-fg',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-status-open-bg text-status-open-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-closed-bg text-status-closed-fg',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/badge.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `Card`**

```tsx
// apps/web/src/components/ui/card.tsx
import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-border bg-surface ${className}`} {...props} />;
}

export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col items-stretch gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
      {...props}
    />
  );
}

export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-base font-semibold text-text ${className}`} {...props} />;
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 ${className}`} {...props} />;
}
```

- [ ] **Step 6: Implement `EmptyState`, `Skeleton`, `StatCard`**

```tsx
// apps/web/src/components/ui/empty-state.tsx
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

```tsx
// apps/web/src/components/ui/skeleton.tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-muted ${className}`} />;
}
```

```tsx
// apps/web/src/components/ui/stat-card.tsx
import type { ReactNode } from 'react';
import { Card } from './card';

export function StatCard({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      {icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          {icon}
        </span>
      )}
      <div>
        <p className="text-2xl font-semibold text-text">{value}</p>
        <p className="text-sm text-text-muted">{label}</p>
      </div>
    </Card>
  );
}
```

- [ ] **Step 7: Refactor `FestivalStatusBadge` to use `Badge`**

```tsx
// apps/web/src/components/festival-status-badge.tsx
import type { FestivalStatus } from '../lib/api/festivals';
import { Badge, type BadgeTone } from './ui/badge';

const TONE_BY_STATUS: Record<FestivalStatus, BadgeTone> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  CLOSED: 'danger',
};

export function FestivalStatusBadge({ status }: { status: FestivalStatus }) {
  return <Badge tone={TONE_BY_STATUS[status]}>{status}</Badge>;
}
```

- [ ] **Step 8: Run the whole suite (confirms `festival-list.spec.tsx` and `festival-detail.spec.tsx` still pass with the raw status text)**

Run: `cd apps/web && pnpm test`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui/card.tsx apps/web/src/components/ui/badge.tsx apps/web/src/components/ui/badge.spec.tsx apps/web/src/components/ui/empty-state.tsx apps/web/src/components/ui/skeleton.tsx apps/web/src/components/ui/stat-card.tsx apps/web/src/components/festival-status-badge.tsx
git commit -m "feat(web): add Card/Badge/EmptyState/Skeleton/StatCard and refactor FestivalStatusBadge"
```

---

## Task 12: `Breadcrumb` and updated `PageHeader`

**Files:**
- Create: `apps/web/src/components/ui/breadcrumb.tsx`
- Modify: `apps/web/src/components/ui/page-header.tsx`
- Test: `apps/web/src/components/ui/breadcrumb.spec.tsx`

Note: `apps/web/src/components/string-divider.tsx` is NOT deleted in this task even though `PageHeader` stops using it — `festival-detail.tsx` still imports it and isn't rewritten until Task 21, which is where the file is actually deleted (deleting it here would break `festival-detail.spec.tsx`'s module resolution before its consumer is gone).

**Interfaces:**
- Produces: `BreadcrumbItem { label: string; href?: string }`; `Breadcrumb({ items: BreadcrumbItem[] })`; `PageHeader({ title, subtitle?, action?, breadcrumb?: BreadcrumbItem[] })`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/ui/breadcrumb.spec.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './breadcrumb';

describe('Breadcrumb', () => {
  it('renders a link for every item except the last', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Festivais', href: '/festivals' },
          { label: 'FENAC 2026' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Home' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Festivais' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'FENAC 2026' })).toBeNull();
    expect(screen.getByText('FENAC 2026')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/breadcrumb.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `Breadcrumb`**

```tsx
// apps/web/src/components/ui/breadcrumb.tsx
import Link from 'next/link';
import { ChevronRightIcon } from './icons';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRightIcon className="h-3.5 w-3.5" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-text">
              {item.label}
            </Link>
          ) : (
            <span className={index === items.length - 1 ? 'text-text' : undefined}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/breadcrumb.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Update `PageHeader`**

```tsx
// apps/web/src/components/ui/page-header.tsx
import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-text-muted">{subtitle}</div>}
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        {action}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the whole suite**

Run: `cd apps/web && pnpm test`
Expected: all green — `PageHeader` no longer renders `StringDivider`, but `apps/web/src/components/string-divider.tsx` still exists on disk (still imported by the not-yet-rewritten `festival-detail.tsx`), so nothing is broken.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui/breadcrumb.tsx apps/web/src/components/ui/breadcrumb.spec.tsx apps/web/src/components/ui/page-header.tsx
git commit -m "feat(web): add Breadcrumb and wire it into PageHeader, drop StringDivider"
```

---

## Task 13: `Table` primitives, `DataTable`, `Pagination`

**Files:**
- Create: `apps/web/src/components/ui/table.tsx`
- Create: `apps/web/src/components/ui/data-table.tsx`
- Create: `apps/web/src/components/ui/pagination.tsx`
- Test: `apps/web/src/components/ui/data-table.spec.tsx`
- Test: `apps/web/src/components/ui/pagination.spec.tsx`

**Interfaces:**
- Produces: `Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`; `DataTableColumn<T> { header: string; render: (row: T) => ReactNode; className?: string }`; `DataTable<T>({ title, action?, columns, rows, rowKey, isLoading?, searchPlaceholder?, searchFields?, emptyTitle?, emptyDescription? })`; `Pagination({ page, totalPages, onPageChange })`.

- [ ] **Step 1: Implement `Table` primitives (no dedicated test — exercised via `DataTable`)**

```tsx
// apps/web/src/components/ui/table.tsx
import type { HTMLAttributes, ThHTMLAttributes } from 'react';

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-left text-sm ${className}`} {...props} />
    </div>
  );
}

export function TableHead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-surface-muted ${className}`} {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-border last:border-0 ${className}`} {...props} />;
}

export function TableHeaderCell({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-3 font-medium text-text-muted ${className}`} {...props} />;
}
```

- [ ] **Step 2: Write the failing test for `DataTable`**

```tsx
// apps/web/src/components/ui/data-table.spec.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: '1', name: 'Alfa' },
  { id: '2', name: 'Beta' },
];

const columns: DataTableColumn<Row>[] = [{ header: 'Nome', render: (row) => row.name }];

describe('DataTable', () => {
  it('renders every row', () => {
    render(<DataTable title="Itens" columns={columns} rows={rows} rowKey={(row) => row.id} />);
    expect(screen.getByText('Alfa')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
  });

  it('filters rows by the search box when searchFields is given', () => {
    render(
      <DataTable
        title="Itens"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        searchFields={(row) => [row.name]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'Alfa' } });
    expect(screen.getByText('Alfa')).toBeDefined();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('shows the empty state when there are no rows', () => {
    render(
      <DataTable
        title="Itens"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        emptyTitle="Nada aqui"
      />,
    );
    expect(screen.getByText('Nada aqui')).toBeDefined();
  });

  it('shows loading skeletons when isLoading is true', () => {
    const { container } = render(
      <DataTable title="Itens" columns={columns} rows={[]} rowKey={(row) => row.id} isLoading />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alfa')).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/data-table.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement `DataTable`**

```tsx
// apps/web/src/components/ui/data-table.tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Card, CardHeader, CardTitle } from './card';
import { Table, TableBody, TableHead, TableHeaderCell, TableRow } from './table';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';
import { SearchIcon } from './icons';

export interface DataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title: string;
  action?: ReactNode;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchFields?: (row: T) => string[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  title,
  action,
  columns,
  rows,
  rowKey,
  isLoading = false,
  searchPlaceholder = 'Buscar…',
  searchFields,
  emptyTitle = 'Nada por aqui ainda',
  emptyDescription,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchFields || query.trim() === '') return rows;
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => searchFields(row).some((field) => field.toLowerCase().includes(normalizedQuery)));
  }, [rows, query, searchFields]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-3">
          {searchFields && (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-border bg-canvas py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline-none sm:w-56"
              />
            </div>
          )}
          {action}
        </div>
      </CardHeader>
      {isLoading ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeaderCell key={column.header} className={column.className}>
                  {column.header}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.header} className={`px-4 py-3 text-text ${column.className ?? ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/data-table.spec.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing test for `Pagination`**

```tsx
// apps/web/src/components/ui/pagination.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('disables Anterior on the first page and Próxima on the last page', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Próxima' })).toHaveProperty('disabled', false);
  });

  it('calls onPageChange with the next page number', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run src/components/ui/pagination.spec.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 8: Implement `Pagination`**

```tsx
// apps/web/src/components/ui/pagination.tsx
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between border-t border-border px-5 py-3">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-sm text-text-muted">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próxima
      </button>
    </nav>
  );
}
```

- [ ] **Step 9: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run src/components/ui/pagination.spec.tsx`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/ui/table.tsx apps/web/src/components/ui/data-table.tsx apps/web/src/components/ui/data-table.spec.tsx apps/web/src/components/ui/pagination.tsx apps/web/src/components/ui/pagination.spec.tsx
git commit -m "feat(web): add Table primitives, DataTable and Pagination"
```

---

## Task 14: Restyle the login page

**Files:**
- Modify: `apps/web/app/(admin)/login/page.tsx`
- Modify: `apps/web/app/(admin)/login/login-form.tsx`

**Interfaces:**
- Consumes: `Card` (Task 11), `Field`/`Input`/`Label`/`FieldError`/`Button` (Task 3), `BrandMark` (existing).
- No behavior change — `login-form.spec.tsx` must pass unmodified.

- [ ] **Step 1: Restyle `page.tsx`**

```tsx
// apps/web/app/(admin)/login/page.tsx
import { LoginForm } from './login-form';
import { BrandMark } from '../../../src/components/brand-mark';
import { Card } from '../../../src/components/ui/card';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="h-14 w-14" />
          <div>
            <h1 className="text-2xl font-semibold text-text">FENAC</h1>
            <p className="text-sm text-text-muted">Área Administrativa</p>
          </div>
        </div>
        <Card className="p-6">
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Restyle `login-form.tsx` (only replace the submit `Button` with the new `loading` prop; form logic untouched)**

```tsx
// apps/web/app/(admin)/login/login-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginAdminUserSchema, type LoginAdminUserDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../src/lib/auth/auth-context';
import { Field, FieldError, Input, Label } from '../../../src/components/ui/field';
import { Button } from '../../../src/components/ui/button';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginAdminUserDto>({
    resolver: zodResolver(loginAdminUserSchema),
  });

  async function onSubmit(values: LoginAdminUserDto) {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      router.push('/festivals');
    } catch {
      setSubmitError('E-mail ou senha inválidos.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full flex-col gap-4">
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} />
        <FieldError>{errors.email?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" {...register('password')} />
        <FieldError>{errors.password?.message}</FieldError>
      </Field>
      <FieldError>{submitError ?? undefined}</FieldError>
      <Button type="submit" loading={isSubmitting} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Run the login tests**

Run: `cd apps/web && pnpm vitest run "app/(admin)/login/login-form.spec.tsx"`
Expected: PASS — unchanged assertions (`getByRole('button', { name: 'Entrar' })` still resolves; `loading` maps to `disabled`, matching `isSubmitting`'s previous effect via `disabled={isSubmitting}`).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(admin)/login/page.tsx" "apps/web/app/(admin)/login/login-form.tsx"
git commit -m "feat(web): restyle the login page with the new design system"
```

---

## Task 15: Dashboard page (`/dashboard`)

**Files:**
- Create: `apps/web/app/(admin)/(protected)/dashboard/page.tsx`
- Create: `apps/web/app/(admin)/(protected)/dashboard/dashboard-view.tsx`
- Test: `apps/web/app/(admin)/(protected)/dashboard/dashboard-view.spec.tsx`

**Interfaces:**
- Consumes: `useAuth`, `listFestivals` (existing), `PageHeader` (Task 12), `StatCard` (Task 11), icons (Task 2).
- Produces: `DashboardView()`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/app/(admin)/(protected)/dashboard/dashboard-view.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardView } from './dashboard-view';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../src/lib/api/festivals';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DashboardView', () => {
  it('shows real counts derived from the festival list', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([
      { id: '1', number: 1, year: 2024, name: 'A', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'OPEN', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
      { id: '2', number: 2, year: 2025, name: 'B', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'OPEN', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
      { id: '3', number: 3, year: 2025, name: 'C', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'DRAFT', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
      { id: '4', number: 4, year: 2025, name: 'D', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'CLOSED', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
    ]);

    renderWithQueryClient(<DashboardView />);

    expect(await screen.findByText('Dashboard')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Festivais cadastrados')).toBeDefined();
    expect(screen.getByText('Festivais abertos')).toBeDefined();
    expect(screen.getByText('Em rascunho')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/dashboard/dashboard-view.spec.tsx"`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `DashboardView`**

```tsx
// apps/web/app/(admin)/(protected)/dashboard/dashboard-view.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listFestivals } from '../../../../src/lib/api/festivals';
import { PageHeader } from '../../../../src/components/ui/page-header';
import { StatCard } from '../../../../src/components/ui/stat-card';
import { CalendarIcon, TrendingUpIcon, AwardIcon } from '../../../../src/components/ui/icons';

export function DashboardView() {
  const { accessToken } = useAuth();
  const { data: festivals } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null,
  });

  const total = festivals?.length ?? 0;
  const open = festivals?.filter((festival) => festival.status === 'OPEN').length ?? 0;
  const draft = festivals?.filter((festival) => festival.status === 'DRAFT').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" breadcrumb={[{ label: 'Home' }, { label: 'Dashboard' }]} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Festivais cadastrados" value={total} icon={<CalendarIcon className="h-5 w-5" />} />
        <StatCard label="Festivais abertos" value={open} icon={<TrendingUpIcon className="h-5 w-5" />} />
        <StatCard label="Em rascunho" value={draft} icon={<AwardIcon className="h-5 w-5" />} />
      </div>
    </div>
  );
}
```

```tsx
// apps/web/app/(admin)/(protected)/dashboard/page.tsx
import { DashboardView } from './dashboard-view';

export default function DashboardPage() {
  return <DashboardView />;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/dashboard/dashboard-view.spec.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/dashboard"
git commit -m "feat(web): add the Dashboard page with real festival counts"
```

---

## Task 16: Restyle the festivals list

**Files:**
- Modify: `apps/web/app/(admin)/(protected)/festivals/festival-list.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 12), `DataTable` (Task 13), `FestivalStatusBadge` (Task 11), `buttonStyles` (Task 3).
- `festival-list.spec.tsx` must pass unmodified.

- [ ] **Step 1: Rewrite `festival-list.tsx`**

```tsx
// apps/web/app/(admin)/(protected)/festivals/festival-list.tsx
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listFestivals, type Festival } from '../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../src/components/festival-status-badge';
import { PageHeader } from '../../../../src/components/ui/page-header';
import { buttonStyles } from '../../../../src/components/ui/button';
import { DataTable, type DataTableColumn } from '../../../../src/components/ui/data-table';

const COLUMNS: DataTableColumn<Festival>[] = [
  { header: 'Edição', render: (festival) => `${festival.number}/${festival.year}` },
  {
    header: 'Nome',
    render: (festival) => (
      <Link href={`/festivals/${festival.id}`} className="font-medium text-brand hover:underline">
        {festival.name}
      </Link>
    ),
  },
  { header: 'Status', render: (festival) => <FestivalStatusBadge status={festival.status} /> },
];

export function FestivalList() {
  const { accessToken } = useAuth();
  const { data: festivals, isLoading } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Festivais"
        breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Festivais' }]}
        action={
          <Link href="/festivals/new" className={buttonStyles('primary')}>
            Novo Festival
          </Link>
        }
      />
      <DataTable
        title="Todos os festivais"
        columns={COLUMNS}
        rows={festivals ?? []}
        rowKey={(festival) => festival.id}
        isLoading={isLoading}
        searchFields={(festival) => [festival.name, `${festival.number}/${festival.year}`]}
        emptyTitle="Nenhum festival cadastrado"
        emptyDescription="Crie o primeiro festival para começar."
      />
    </div>
  );
}
```

- [ ] **Step 2: Run the existing test**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/festival-list.spec.tsx"`
Expected: PASS — `screen.getByText('FENAC 2026')` and `screen.getByText('DRAFT')` both still render.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/festival-list.tsx"
git commit -m "feat(web): restyle the festival list with DataTable"
```

---

## Task 17: Restyle the "Novo Festival" page

**Files:**
- Modify: `apps/web/app/(admin)/(protected)/festivals/new/create-festival-form.tsx`

**Interfaces:**
- Consumes: `Card` (Task 11), `Field`/`Input`/`Label`/`FieldError`/`Button` (Task 3), `PageHeader` (Task 12).
- `create-festival-form.spec.tsx` and `admin-festival-flow.spec.ts` (e2e) must pass unmodified — same field ids/labels, same button label "Criar Festival", same route.

- [ ] **Step 1: Rewrite `create-festival-form.tsx`**

```tsx
// apps/web/app/(admin)/(protected)/festivals/new/create-festival-form.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFestivalSchema } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { createFestival } from '../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../src/components/ui/field';
import { Button } from '../../../../../src/components/ui/button';
import { PageHeader } from '../../../../../src/components/ui/page-header';
import { Card } from '../../../../../src/components/ui/card';

type CreateFestivalFormValues = z.input<typeof createFestivalSchema>;

export function CreateFestivalForm() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateFestivalFormValues>({
    resolver: zodResolver(createFestivalSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateFestivalFormValues) =>
      createFestival(accessToken as string, createFestivalSchema.parse(values)),
    onSuccess: (festival) => {
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
      router.push(`/festivals/${festival.id}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Novo Festival"
        breadcrumb={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Festivais', href: '/festivals' },
          { label: 'Novo Festival' },
        ]}
      />
      <Card className="max-w-lg p-6">
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="number">Número</Label>
            <Input id="number" type="number" {...register('number', { valueAsNumber: true })} />
            <FieldError>{errors.number?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="year">Ano</Label>
            <Input id="year" type="number" {...register('year', { valueAsNumber: true })} />
            <FieldError>{errors.year?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" type="text" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="registrationBegin">Início das inscrições</Label>
            <Input id="registrationBegin" type="datetime-local" {...register('registrationBegin')} />
            <FieldError>{errors.registrationBegin?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="registrationEnd">Fim das inscrições</Label>
            <Input id="registrationEnd" type="datetime-local" {...register('registrationEnd')} />
            <FieldError>{errors.registrationEnd?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="inscriptionFee">Valor da inscrição</Label>
            <Input
              id="inscriptionFee"
              type="number"
              step="0.01"
              {...register('inscriptionFee', { valueAsNumber: true })}
            />
            <FieldError>{errors.inscriptionFee?.message}</FieldError>
          </Field>

          <FieldError>
            {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar festival.') : undefined}
          </FieldError>

          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Criar Festival
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing test**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/new/create-festival-form.spec.tsx"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/new/create-festival-form.tsx"
git commit -m "feat(web): restyle the Novo Festival page with the new Card/Field components"
```

---

## Task 18: Move "Nova Fase" into a `FormModal`

**Files:**
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.spec.tsx`
- Delete: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/create-stage-form.tsx`
- Delete: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/create-stage-form.spec.tsx`
- Delete: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/page.tsx`

**Interfaces:**
- Produces: `CreateStageForm({ festivalId, open?, onOpenChange? })` — `open` defaults to `true`, `onOpenChange` defaults to a no-op (keeps the moved test working without passing those props).

- [ ] **Step 1: Move the spec, adjusting the relative import depth and adding open/close coverage**

```tsx
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateStageForm } from './create-stage-form';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../src/lib/api/festivals';

vi.mock('../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../src/lib/api/festivals');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CreateStageForm', () => {
  it('submits the form and navigates back to the festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createStage).mockResolvedValue({
      id: 's1',
      festivalId: 'f1',
      name: 'Classificatória',
      order: 1,
      advancementQuota: null,
    });

    renderWithQueryClient(<CreateStageForm festivalId="f1" />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Classificatória');
    await userEvent.type(screen.getByLabelText('Ordem'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Fase' }));

    await waitFor(() =>
      expect(festivalsApi.createStage).toHaveBeenCalledWith('token-1', 'f1', {
        name: 'Classificatória',
        order: 1,
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });

  it('calls onOpenChange(false) after a successful submit', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createStage).mockResolvedValue({
      id: 's1',
      festivalId: 'f1',
      name: 'Classificatória',
      order: 1,
      advancementQuota: null,
    });
    const onOpenChange = vi.fn();

    renderWithQueryClient(<CreateStageForm festivalId="f1" open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Classificatória');
    await userEvent.type(screen.getByLabelText('Ordem'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Fase' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('renders nothing when open is false', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithQueryClient(<CreateStageForm festivalId="f1" open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByLabelText('Nome')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm the new assertions fail (module still has the old shape/location)**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.spec.tsx"`
Expected: FAIL — `Cannot find module './create-stage-form'`.

- [ ] **Step 3: Create the moved, modal-based component**

```tsx
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createStageSchema, type CreateStageDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { createStage } from '../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../src/components/ui/field';
import { FormModal } from '../../../../../src/components/ui/form-modal';

export function CreateStageForm({
  festivalId,
  open = true,
  onOpenChange = () => {},
}: {
  festivalId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStageDto>({
    resolver: zodResolver(createStageSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateStageDto) => createStage(accessToken as string, festivalId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId, 'stages'] });
      router.push(`/festivals/${festivalId}`);
      reset();
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova Fase"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Criar Fase"
    >
      <Field>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" type="text" {...register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="order">Ordem</Label>
        <Input id="order" type="number" {...register('order', { valueAsNumber: true })} />
        <FieldError>{errors.order?.message}</FieldError>
      </Field>

      <FieldError>
        {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar fase.') : undefined}
      </FieldError>
    </FormModal>
  );
}
```

- [ ] **Step 4: Delete the old page/component/spec**

```bash
git rm -r "apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new"
```

- [ ] **Step 5: Run the moved spec to confirm it passes**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.spec.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.tsx" "apps/web/app/(admin)/(protected)/festivals/[festivalId]/create-stage-form.spec.tsx"
git commit -m "feat(web): move Nova Fase from a page to a FormModal"
```

Note: `festival-detail.tsx` still references the old `stages/new` route in a `<Link>` and will fail to build until Task 20 rewrites it — Task 20 is the very next task, so this intermediate state is not committed as a broken build for more than one task.

---

## Task 19: Move "Novo Critério de Nota" into a `FormModal`

**Files:**
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.spec.tsx`
- Delete: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria/new/` (entire directory: component, spec, page)

**Interfaces:**
- Produces: `CreateGradeCriterionForm({ stageId, festivalId, open?, onOpenChange? })` — same default pattern as Task 18.

- [ ] **Step 1: Move the spec, adjusting the relative import depth and adding open/close coverage**

```tsx
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateGradeCriterionForm } from './create-grade-criterion-form';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../../../src/lib/api/festivals';

vi.mock('../../../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../../../src/lib/api/festivals');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CreateGradeCriterionForm', () => {
  it('submits the form and navigates back to the festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createGradeCriterion).mockResolvedValue({
      id: 'g1',
      stageId: 's1',
      name: 'Afinação',
      weight: 2,
    });

    renderWithQueryClient(<CreateGradeCriterionForm stageId="s1" festivalId="f1" />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Afinação');
    await userEvent.type(screen.getByLabelText('Peso'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Critério' }));

    await waitFor(() =>
      expect(festivalsApi.createGradeCriterion).toHaveBeenCalledWith('token-1', 's1', {
        name: 'Afinação',
        weight: 2,
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });

  it('renders nothing when open is false', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithQueryClient(
      <CreateGradeCriterionForm stageId="s1" festivalId="f1" open={false} onOpenChange={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Nome')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.spec.tsx"`
Expected: FAIL — module doesn't exist at the new path.

- [ ] **Step 3: Create the moved, modal-based component**

```tsx
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createGradeCriterionSchema, type CreateGradeCriterionDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import { createGradeCriterion } from '../../../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../../../src/components/ui/field';
import { FormModal } from '../../../../../../../src/components/ui/form-modal';

export function CreateGradeCriterionForm({
  stageId,
  festivalId,
  open = true,
  onOpenChange = () => {},
}: {
  stageId: string;
  festivalId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGradeCriterionDto>({
    resolver: zodResolver(createGradeCriterionSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateGradeCriterionDto) => createGradeCriterion(accessToken as string, stageId, values),
    onSuccess: () => {
      router.push(`/festivals/${festivalId}`);
      reset();
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Novo Critério de Nota"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Criar Critério"
    >
      <Field>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" type="text" {...register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="weight">Peso</Label>
        <Input id="weight" type="number" step="0.01" {...register('weight', { valueAsNumber: true })} />
        <FieldError>{errors.weight?.message}</FieldError>
      </Field>

      <FieldError>
        {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar critério de nota.') : undefined}
      </FieldError>
    </FormModal>
  );
}
```

- [ ] **Step 4: Delete the old page/component/spec**

```bash
git rm -r "apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria"
```

- [ ] **Step 5: Run the moved spec to confirm it passes**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.spec.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.tsx" "apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.spec.tsx"
git commit -m "feat(web): move Novo Critério de Nota from a page to a FormModal"
```

---

## Task 20: `EditFestivalForm` (new feature, using the already-existing `updateFestival` endpoint)

**Files:**
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.spec.tsx`

**Interfaces:**
- Consumes: `updateFestival`, `type Festival` (existing, `src/lib/api/festivals.ts`), `updateFestivalSchema` (existing, `@fenac-platform/contracts`), `FormModal` (Task 4).
- Produces: `EditFestivalForm({ festival, open, onOpenChange })`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditFestivalForm } from './edit-festival-form';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../src/lib/api/festivals';
import type { Festival } from '../../../../../src/lib/api/festivals';

vi.mock('../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const festival: Festival = {
  id: 'f1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: '2026-01-01T08:00:00.000Z',
  registrationEnd: '2026-03-01T18:00:00.000Z',
  votingBegin: null,
  votingEnd: null,
  status: 'DRAFT',
  inscriptionFee: 25,
  regulationUrl: null,
  allowedStates: [],
};

describe('EditFestivalForm', () => {
  it('pre-fills the form with the current festival data', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithQueryClient(<EditFestivalForm festival={festival} open onOpenChange={vi.fn()} />);

    // react-hook-form's `values` option repopulates the form in an effect
    // after mount, not synchronously during the first render — wait for it
    // rather than asserting immediately.
    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveProperty('value', 'FENAC 2026'));
    expect(screen.getByLabelText('Valor da inscrição')).toHaveProperty('value', '25');
  });

  it('submits the edited values, calls updateFestival and closes the modal', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.updateFestival).mockResolvedValue({ ...festival, name: 'FENAC 2026 (editado)' });
    const onOpenChange = vi.fn();

    renderWithQueryClient(<EditFestivalForm festival={festival} open onOpenChange={onOpenChange} />);

    const nameInput = screen.getByLabelText('Nome');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'FENAC 2026 (editado)');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() =>
      expect(festivalsApi.updateFestival).toHaveBeenCalledWith(
        'token-1',
        'f1',
        expect.objectContaining({ name: 'FENAC 2026 (editado)', inscriptionFee: 25 }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.spec.tsx"`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `EditFestivalForm`**

```tsx
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFestivalSchema } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { updateFestival, type Festival } from '../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../src/components/ui/field';
import { FormModal } from '../../../../../src/components/ui/form-modal';

interface EditFestivalFormValues {
  name: string;
  registrationBegin: string;
  registrationEnd: string;
  inscriptionFee: number;
}

function toDateTimeLocal(isoString: string): string {
  return isoString ? isoString.slice(0, 16) : '';
}

export function EditFestivalForm({
  festival,
  open,
  onOpenChange,
}: {
  festival: Festival;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFestivalFormValues>({
    resolver: zodResolver(updateFestivalSchema),
    values: {
      name: festival.name,
      registrationBegin: toDateTimeLocal(festival.registrationBegin),
      registrationEnd: toDateTimeLocal(festival.registrationEnd),
      inscriptionFee: festival.inscriptionFee,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: EditFestivalFormValues) =>
      updateFestival(accessToken as string, festival.id, updateFestivalSchema.parse(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festival.id] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Festival"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Salvar Alterações"
    >
      <Field>
        <Label htmlFor="edit-name">Nome</Label>
        <Input id="edit-name" type="text" {...register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="edit-registrationBegin">Início das inscrições</Label>
        <Input id="edit-registrationBegin" type="datetime-local" {...register('registrationBegin')} />
        <FieldError>{errors.registrationBegin?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="edit-registrationEnd">Fim das inscrições</Label>
        <Input id="edit-registrationEnd" type="datetime-local" {...register('registrationEnd')} />
        <FieldError>{errors.registrationEnd?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="edit-inscriptionFee">Valor da inscrição</Label>
        <Input
          id="edit-inscriptionFee"
          type="number"
          step="0.01"
          {...register('inscriptionFee', { valueAsNumber: true })}
        />
        <FieldError>{errors.inscriptionFee?.message}</FieldError>
      </Field>

      <FieldError>
        {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao editar festival.') : undefined}
      </FieldError>
    </FormModal>
  );
}
```

Note the `Label htmlFor`/`Input id` pairs use an `edit-` prefix — this page will render both `EditFestivalForm` and the create-flow-style fields side by side in the same tree (via the stage/criterion modals in Task 21), so ids must stay unique; the field **labels** (`Nome`, `Início das inscrições`, …) are unchanged, matching what the test above queries by.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.spec.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.tsx" "apps/web/app/(admin)/(protected)/festivals/[festivalId]/edit-festival-form.spec.tsx"
git commit -m "feat(web): add Editar Festival form modal using the existing updateFestival endpoint"
```

---

## Task 21: Rewrite `FestivalDetail` — wire in Editar/Fechar/Nova Fase/Novo Critério

**Files:**
- Modify: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.tsx`
- Modify: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.spec.tsx`
- Delete: `apps/web/src/components/string-divider.tsx` (its last consumer, the old `festival-detail.tsx`, is rewritten below without it)

**Interfaces:**
- Consumes: `EditFestivalForm` (Task 20), `CreateStageForm` (Task 18), `CreateGradeCriterionForm` (Task 19), `ConfirmModal` (Task 2), `Card`/`CardHeader`/`CardTitle`/`CardContent` (Task 11), `PageHeader` (Task 12), `PencilIcon`/`PlusIcon` (Task 2).
- Existing 4 tests (draft/open/closed button visibility, "Publicar" click) must keep passing unmodified in behavior; this task **adds** new tests for Editar/Fechar-confirm/Nova Fase/Novo Critério.

- [ ] **Step 1: Add the new failing tests to `festival-detail.spec.tsx` (append to the existing `describe` block, keep the 4 existing tests as-is)**

```tsx
// append inside the existing describe('FestivalDetail', () => { ... }) block in
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.spec.tsx

  it('opens the edit modal when "Editar" is clicked, pre-filled with the current name', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue(draftFestival);

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);
    await screen.findByText('FENAC 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));

    expect(screen.getByRole('dialog', { name: 'Editar Festival' })).toBeDefined();
    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveProperty('value', 'FENAC 2026'));
  });

  it('requires confirmation before closing an OPEN festival', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue({ ...draftFestival, status: 'OPEN' });
    vi.mocked(festivalsApi.closeFestival).mockResolvedValue({ ...draftFestival, status: 'CLOSED' });

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);
    await screen.findByText('FENAC 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(festivalsApi.closeFestival).not.toHaveBeenCalled();
    expect(screen.getByText('Fechar festival?')).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Fechar Festival' }));
    await waitFor(() => expect(festivalsApi.closeFestival).toHaveBeenCalledWith('token-1', 'f1'));
  });

  it('opens the Nova Fase modal from the stages card', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue(draftFestival);

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);
    await screen.findByText('FENAC 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Nova Fase' }));
    expect(screen.getByRole('dialog', { name: 'Nova Fase' })).toBeDefined();
  });

  it('opens the Novo Critério modal for the clicked stage', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue(draftFestival);
    vi.mocked(festivalsApi.listStages).mockResolvedValue([
      { id: 's1', festivalId: 'f1', name: 'Classificatória', order: 1, advancementQuota: null },
    ]);

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);
    await screen.findByText('FENAC 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Novo Critério' }));
    expect(screen.getByRole('dialog', { name: 'Novo Critério de Nota' })).toBeDefined();
  });
```

- [ ] **Step 2: Run the spec to confirm the new tests fail**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/festival-detail.spec.tsx"`
Expected: the 4 pre-existing tests still PASS against the old component; the 4 new tests FAIL (no "Editar" button, "Fechar" still mutates immediately, no stage-list "Novo Critério" button in current markup, etc).

- [ ] **Step 3: Rewrite `festival-detail.tsx`**

```tsx
// apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { closeFestival, getFestival, listStages, publishFestival } from '../../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../../src/components/festival-status-badge';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Button } from '../../../../../src/components/ui/button';
import { FieldError } from '../../../../../src/components/ui/field';
import { PageHeader } from '../../../../../src/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../src/components/ui/card';
import { ConfirmModal } from '../../../../../src/components/ui/confirm-modal';
import { PencilIcon, PlusIcon } from '../../../../../src/components/ui/icons';
import { EditFestivalForm } from './edit-festival-form';
import { CreateStageForm } from './create-stage-form';
import { CreateGradeCriterionForm } from './stages/[stageId]/create-grade-criterion-form';

export function FestivalDetail({ festivalId }: { festivalId: string }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [criterionStageId, setCriterionStageId] = useState<string | null>(null);

  const festivalQuery = useQuery({
    queryKey: ['festivals', festivalId],
    queryFn: () => getFestival(accessToken as string, festivalId),
    enabled: accessToken !== null,
  });

  const stagesQuery = useQuery({
    queryKey: ['festivals', festivalId, 'stages'],
    queryFn: () => listStages(accessToken as string, festivalId),
    enabled: accessToken !== null,
  });

  const publishMutation = useMutation({
    mutationFn: () => publishFestival(accessToken as string, festivalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeFestival(accessToken as string, festivalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
      setCloseConfirmOpen(false);
    },
  });

  if (festivalQuery.isLoading) return <p className="text-sm text-text-muted">Carregando…</p>;
  if (!festivalQuery.data) return <p className="text-sm text-text-muted">Festival não encontrado.</p>;

  const festival = festivalQuery.data;
  const stages = stagesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={festival.name}
        subtitle={`${festival.number}/${festival.year}`}
        breadcrumb={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Festivais', href: '/festivals' },
          { label: festival.name },
        ]}
        action={
          <div className="flex items-center gap-3">
            <FestivalStatusBadge status={festival.status} />
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <PencilIcon className="h-4 w-4" />
              Editar
            </Button>
            {festival.status === 'DRAFT' && (
              <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                Publicar
              </Button>
            )}
            {festival.status === 'OPEN' && (
              <Button variant="danger" size="sm" onClick={() => setCloseConfirmOpen(true)}>
                Fechar
              </Button>
            )}
          </div>
        }
      />

      <FieldError>
        {publishMutation.isError ? getApiErrorMessage(publishMutation.error, 'Erro ao publicar festival.') : undefined}
      </FieldError>
      <FieldError>
        {closeMutation.isError ? getApiErrorMessage(closeMutation.error, 'Erro ao fechar festival.') : undefined}
      </FieldError>

      <Card>
        <CardHeader>
          <CardTitle>Fases</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setStageModalOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Nova Fase
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {stages.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-text-muted">Nenhuma fase cadastrada ainda.</p>
          ) : (
            stages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0"
              >
                <span className="text-sm text-text">
                  {stage.order}. {stage.name}
                </span>
                <button
                  type="button"
                  onClick={() => setCriterionStageId(stage.id)}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Novo Critério
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <EditFestivalForm festival={festival} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmModal
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Fechar festival?"
        description="As inscrições e avaliações deste festival serão encerradas. Essa ação não pode ser desfeita."
        confirmLabel="Fechar Festival"
        confirmVariant="danger"
        isConfirming={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
      />

      <CreateStageForm festivalId={festivalId} open={stageModalOpen} onOpenChange={setStageModalOpen} />

      <CreateGradeCriterionForm
        stageId={criterionStageId ?? ''}
        festivalId={festivalId}
        open={criterionStageId !== null}
        onOpenChange={(open) => {
          if (!open) setCriterionStageId(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Delete the now-unused `StringDivider` (the rewritten `festival-detail.tsx` above no longer imports it, and it was its last consumer)**

```bash
git rm apps/web/src/components/string-divider.tsx
```

- [ ] **Step 5: Give the `Modal`'s dialog an accessible name matching its title (required for the `getByRole('dialog', { name: ... })` queries used above)**

Modify `apps/web/src/components/ui/modal.tsx` — the `role="dialog"` element already has `aria-labelledby={titleId}` pointing at the `<h2 id={titleId}>{title}</h2>` (a per-instance id from `useId()`, so it stays unique even if this app ever renders more than one `Modal` in the tree at once), which is exactly what gives the dialog its accessible name matching `title`. No code change needed here — this step is a checkpoint: re-read `modal.tsx` from Task 2 and confirm this wiring is present (it is).

- [ ] **Step 6: Run the full `festival-detail.spec.tsx` suite**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/festivals/[festivalId]/festival-detail.spec.tsx"`
Expected: PASS — all 8 tests (4 original + 4 new).

- [ ] **Step 7: Run the whole suite**

Run: `cd apps/web && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.tsx" "apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.spec.tsx" apps/web/src/components/string-divider.tsx
git commit -m "feat(web): wire Editar/Fechar/Nova Fase/Novo Critério modals into FestivalDetail"
```

---

## Task 22: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit/component test suite**

Run: `cd apps/web && pnpm test`
Expected: all tests pass, including every spec touched or added in Tasks 1-21.

- [ ] **Step 2: Run the linter**

Run: `cd apps/web && pnpm lint`
Expected: no errors. Fix any reported issue (unused imports are the most likely — e.g. leftover imports from files that no longer use `StringDivider`/old token names) before proceeding.

- [ ] **Step 3: Run a production build (exercises full `tsc` type-checking across every file touched in this plan)**

Run: `cd apps/web && pnpm build`
Expected: builds successfully. If it fails on a type error in `confirm-modal.tsx`, `edit-festival-form.tsx`, or similar, fix the reported type error directly (the most likely case is a stale import path after Task 18/19's file moves).

- [ ] **Step 4: Manual visual check in the browser**

Run: `cd apps/web && pnpm dev` (needs `apps/api` running too, or at least reachable, for login to succeed — see `docs/specs/2026-09-16-frontend-admin-design.md` §6 for the local admin seed script).

Check, in a real browser:
- `/login` — centered card, brand mark, no layout shift.
- `/dashboard` — sidebar shows all 5 groups with the right active/soon states, "Dashboard" highlighted; stat cards show real counts.
- `/festivals` — DataTable renders, search box filters by typing, "Novo Festival" navigates to a full page.
- `/festivals/[id]` — "Editar" opens a modal pre-filled with the festival's data; "Fechar" (only visible on an OPEN festival) opens a confirm dialog first; "Nova Fase" and each stage's "Novo Critério" open `FormModal`s.
- Click the theme toggle in the header — the whole app switches to dark mode instantly, colors stay legible, click again to return to light.
- Resize the window below 1024px — sidebar collapses into an off-canvas drawer opened by the header's hamburger button.
- Press `⌘K`/`Ctrl+K` anywhere in the app — command palette opens, typing filters nav items, clicking one navigates and closes the palette.

Fix anything visually broken before considering this plan done — this step has no automated pass/fail; the standard is "looks and behaves like the reference design", per the `frontend-design` skill's requirement to verify in a real browser before claiming completion.

- [ ] **Step 5: Final commit (only if Steps 2-4 required fixes)**

```bash
git add -A
git commit -m "fix(web): address lint/build/visual issues found in final verification"
```
