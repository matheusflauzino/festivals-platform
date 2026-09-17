import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateFestivalForm } from './create-festival-form';
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

describe('CreateFestivalForm', () => {
  it('submits the form and navigates to the new festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createFestival).mockResolvedValue({
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
    });

    renderWithQueryClient(<CreateFestivalForm />);

    await userEvent.type(screen.getByLabelText('Número'), '58');
    await userEvent.type(screen.getByLabelText('Ano'), '2026');
    await userEvent.type(screen.getByLabelText('Nome'), 'FENAC 2026');
    await userEvent.type(screen.getByLabelText('Início das inscrições'), '2026-01-01T08:00');
    await userEvent.type(screen.getByLabelText('Fim das inscrições'), '2026-03-01T18:00');
    await userEvent.type(screen.getByLabelText('Valor da inscrição'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Festival' }));

    await waitFor(() => expect(festivalsApi.createFestival).toHaveBeenCalledWith('token-1', {
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01T08:00'),
      registrationEnd: new Date('2026-03-01T18:00'),
      inscriptionFee: 25,
    }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });
});
