import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FestivalDetail } from './festival-detail';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../src/lib/api/festivals';

vi.mock('../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const draftFestival = {
  id: 'f1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: '2026-01-01T08:00:00.000Z',
  registrationEnd: '2026-03-01T18:00:00.000Z',
  votingBegin: null,
  votingEnd: null,
  status: 'DRAFT' as const,
  inscriptionFee: 25,
  regulationUrl: null,
  allowedStates: [],
};

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
    accessToken: 'token-1',
    login: vi.fn(),
    logout: vi.fn(),
  });
  vi.mocked(festivalsApi.listStages).mockResolvedValue([]);
});

describe('FestivalDetail', () => {
  it('shows a "Publicar" button for a DRAFT festival, not "Fechar"', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue(draftFestival);

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull();
  });

  it('shows a "Fechar" button for an OPEN festival, not "Publicar"', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue({ ...draftFestival, status: 'OPEN' });

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  it('shows neither transition button for a CLOSED festival', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue({ ...draftFestival, status: 'CLOSED' });

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull();
  });

  it('clicking "Publicar" calls publishFestival and refetches', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue(draftFestival);
    vi.mocked(festivalsApi.publishFestival).mockResolvedValue({ ...draftFestival, status: 'OPEN' });

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);
    await screen.findByText('FENAC 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(festivalsApi.publishFestival).toHaveBeenCalledWith('token-1', 'f1'));
  });
});
