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
