import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegistrationsList } from './registrations-list';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as registrationsApi from '../../../../src/lib/api/registrations';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/registrations');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RegistrationsList', () => {
  it('renders each registration with its participant, song and festival edition', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      {
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
      },
    ]);

    renderWithQueryClient(<RegistrationsList />);

    expect(await screen.findByText('Mai Sato')).toBeDefined();
    expect(screen.getByText('Chora Menino')).toBeDefined();
    expect(screen.getByText('58/2026')).toBeDefined();
  });

  it('filters by search across participant and song name', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      {
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
      },
      {
        id: 'r2',
        festivalId: 'f1',
        festivalNumber: 58,
        festivalYear: 2026,
        festivalName: 'FENAC 2026',
        participantName: 'João Silva',
        participantEmail: 'joao@example.com',
        participantCpf: '11111111111',
        songName: 'Luar do Sertão',
        performers: 'João Silva: Viola',
        musicComposer: null,
        lyricsComposer: null,
        videoUrl: null,
        createdAt: '2026-02-13T12:00:00.000Z',
      },
    ]);

    renderWithQueryClient(<RegistrationsList />);

    await screen.findByText('Mai Sato');
    const searchInput = screen.getByPlaceholderText('Buscar…');
    await import('@testing-library/user-event').then(({ default: userEvent }) =>
      userEvent.type(searchInput, 'João'),
    );

    expect(screen.getByText('João Silva')).toBeDefined();
    expect(screen.queryByText('Mai Sato')).toBeNull();
  });
});
