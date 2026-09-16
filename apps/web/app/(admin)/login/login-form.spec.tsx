import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';
import { useAuth } from '../../../src/lib/auth/auth-context';

vi.mock('../../../src/lib/auth/auth-context');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  mockPush.mockReset();
});

describe('LoginForm', () => {
  it('shows a validation error for an invalid email without calling login()', async () => {
    const login = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login,
      logout: vi.fn(),
    });

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    // Note: loginAdminUserSchema uses zod's default z.string().email() message,
    // which in this zod version reads "Invalid email address" (English, not
    // customized in packages/contracts). See admin-auth.schema.ts — no custom
    // message is configured there, and that shared schema is out of scope for
    // this plan, so the assertion below matches the real message instead of
    // the Portuguese text originally guessed in the task brief.
    expect(await screen.findByText(/invalid email/i)).toBeDefined();
    expect(login).not.toHaveBeenCalled();
  });

  it('calls login() with the form values and navigates to /festivals on success', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login,
      logout: vi.fn(),
    });

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('ana@example.com', 'secret'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals'));
  });

  it('shows an error message when login() rejects (invalid credentials)', async () => {
    const login = vi.fn().mockRejectedValue(new Error('invalid credentials'));
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login,
      logout: vi.fn(),
    });

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/e-mail ou senha inválidos/i)).toBeDefined();
  });
});
