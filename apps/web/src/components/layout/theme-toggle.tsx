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
