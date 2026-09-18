import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateRegistrationForm } from './create-registration-form';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as registrationsApi from '../../../../src/lib/api/registrations';
import * as festivalsApi from '../../../../src/lib/api/festivals';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/registrations');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const openFestival = {
  id: 'f1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: '2026-01-01T00:00:00.000Z',
  registrationEnd: '2026-03-01T00:00:00.000Z',
  votingBegin: null,
  votingEnd: null,
  status: 'OPEN' as const,
  inscriptionFee: 25,
  regulationUrl: null,
  allowedStates: [],
};

const draftFestival = { ...openFestival, id: 'f2', number: 59, year: 2027, status: 'DRAFT' as const };

describe('CreateRegistrationForm', () => {
  it('only lists OPEN festivals in the festival select', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([openFestival, draftFestival]);

    renderWithQueryClient(<CreateRegistrationForm open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('58/2026 — FENAC 2026')).toBeDefined());
    expect(screen.queryByText('59/2027 — FENAC 2027')).toBeNull();
  });

  it('submits the form, calls createRegistration with the selected festival, and closes the modal', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([openFestival]);
    vi.mocked(registrationsApi.createRegistration).mockResolvedValue({
      id: 'r1',
      festivalId: 'f1',
      festivalNumber: 58,
      festivalYear: 2026,
      festivalName: 'FENAC 2026',
      participantName: 'Mai Sato',
      participantEmail: 'mai.sato@example.com',
      participantCpf: '86359899531',
      songName: 'Chora Menino',
      performers: 'Mai Sato: Canto e Harpa',
      musicComposer: null,
      lyricsComposer: null,
      videoUrl: null,
      createdAt: '2026-02-12T12:00:00.000Z',
    });
    const onOpenChange = vi.fn();

    renderWithQueryClient(<CreateRegistrationForm open onOpenChange={onOpenChange} />);

    await waitFor(() => expect(screen.getByText('58/2026 — FENAC 2026')).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('Festival'), 'f1');
    await userEvent.type(screen.getByLabelText('Nome do participante'), 'Mai Sato');
    await userEvent.type(screen.getByLabelText('E-mail'), 'mai.sato@example.com');
    await userEvent.type(screen.getByLabelText('CPF'), '86359899531');
    await userEvent.type(screen.getByLabelText('Nome da música'), 'Chora Menino');
    await userEvent.type(screen.getByLabelText('Intérpretes'), 'Mai Sato: Canto e Harpa');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Inscrição' }));

    await waitFor(() =>
      expect(registrationsApi.createRegistration).toHaveBeenCalledWith('token-1', 'f1', {
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
      }),
    );
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

    renderWithQueryClient(<CreateRegistrationForm open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByLabelText('Nome do participante')).toBeNull();
  });
});
