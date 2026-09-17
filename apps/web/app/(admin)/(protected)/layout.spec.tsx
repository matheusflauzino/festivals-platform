import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedLayout from './layout';
import { useAuth } from '../../../src/lib/auth/auth-context';
import { ThemeProvider } from '../../../src/components/layout/theme-provider';

vi.mock('../../../src/lib/auth/auth-context');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/festivals',
}));

describe('ProtectedLayout', () => {
  it('redirects to /login when unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ProtectedLayout>{'content'}</ProtectedLayout>
      </ThemeProvider>,
    );

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('shows a loading state without redirecting while status is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'loading',
      admin: null,
      accessToken: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ProtectedLayout>{'content'}</ProtectedLayout>
      </ThemeProvider>,
    );

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText(/carregando/i)).toBeDefined();
  });

  it('renders the dashboard shell and children when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ProtectedLayout>{'festival list here'}</ProtectedLayout>
      </ThemeProvider>,
    );

    expect(screen.getByText('festival list here')).toBeDefined();
    expect(screen.getByText('Ana')).toBeDefined();
    expect(screen.getByText('Festivais')).toBeDefined();
  });
});
