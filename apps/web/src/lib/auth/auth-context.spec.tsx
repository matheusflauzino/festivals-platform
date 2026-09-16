import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './auth-context';
import * as adminAuth from '../api/admin-auth';

vi.mock('../api/admin-auth');

const admin = { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' as const };

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="admin-name">{auth.admin?.name ?? ''}</span>
      <button onClick={() => auth.login('ana@example.com', 'secret')}>Login</button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

beforeEach(() => {
  vi.mocked(adminAuth.refreshRequest).mockReset();
  vi.mocked(adminAuth.meRequest).mockReset();
  vi.mocked(adminAuth.loginRequest).mockReset();
});

describe('AuthProvider', () => {
  it('restores the session via silent refresh + me on mount when a valid cookie exists', async () => {
    vi.mocked(adminAuth.refreshRequest).mockResolvedValue({ accessToken: 'token-1' });
    vi.mocked(adminAuth.meRequest).mockResolvedValue(admin);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('admin-name').textContent).toBe('Ana');
  });

  it('falls back to unauthenticated when the silent refresh fails (no valid cookie)', async () => {
    vi.mocked(adminAuth.refreshRequest).mockRejectedValue(new Error('no cookie'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(adminAuth.meRequest).not.toHaveBeenCalled();
  });

  it('login() authenticates using the login response directly, without an extra /me call', async () => {
    vi.mocked(adminAuth.refreshRequest).mockRejectedValue(new Error('no cookie'));
    vi.mocked(adminAuth.loginRequest).mockResolvedValue({ accessToken: 'token-2', admin });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('admin-name').textContent).toBe('Ana');
    expect(adminAuth.meRequest).not.toHaveBeenCalled();
  });

  it('logout() clears the session', async () => {
    vi.mocked(adminAuth.refreshRequest).mockResolvedValue({ accessToken: 'token-1' });
    vi.mocked(adminAuth.meRequest).mockResolvedValue(admin);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    await userEvent.click(screen.getByText('Logout'));

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('admin-name').textContent).toBe('');
  });
});
