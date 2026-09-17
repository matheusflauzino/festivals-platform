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
