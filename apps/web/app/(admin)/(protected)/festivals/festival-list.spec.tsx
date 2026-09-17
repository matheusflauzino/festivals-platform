import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FestivalList } from './festival-list';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../src/lib/api/festivals';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('FestivalList', () => {
  it('renders each festival with its status badge', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([
      {
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
      },
    ]);

    renderWithQueryClient(<FestivalList />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.getByText('DRAFT')).toBeDefined();
    await waitFor(() =>
      expect(festivalsApi.listFestivals).toHaveBeenCalledWith('token-1'),
    );
  });
});
