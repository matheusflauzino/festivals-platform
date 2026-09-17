'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../ui/modal';
import { ACTIVE_NAV_ITEMS } from './sidebar-nav-data';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets query only when `open` transitions to false, not during render; a lazy initializer can't observe that transition
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
