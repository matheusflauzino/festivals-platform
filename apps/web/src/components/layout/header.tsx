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
          triggerLabel="Notificações"
          trigger={
            <span className="relative rounded-lg p-2 text-text-muted hover:bg-surface-muted">
              <BellIcon className="h-5 w-5" />
            </span>
          }
        >
          <p className="px-3 py-2 text-sm text-text-muted">Nenhuma notificação por enquanto.</p>
        </DropdownMenu>

        <DropdownMenu
          triggerLabel="Menu do usuário"
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
