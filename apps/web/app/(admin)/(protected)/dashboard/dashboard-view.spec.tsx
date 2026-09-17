import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardView } from './dashboard-view';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../src/lib/api/festivals';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DashboardView', () => {
  it('shows real counts derived from the festival list', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([
      { id: '1', number: 1, year: 2024, name: 'A', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'OPEN', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
      { id: '2', number: 2, year: 2025, name: 'B', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'OPEN', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
      { id: '3', number: 3, year: 2025, name: 'C', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'DRAFT', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
      { id: '4', number: 4, year: 2025, name: 'D', registrationBegin: '', registrationEnd: '', votingBegin: null, votingEnd: null, status: 'CLOSED', inscriptionFee: 0, regulationUrl: null, allowedStates: [] },
    ]);

    renderWithQueryClient(<DashboardView />);

    expect(await screen.findByText('Dashboard')).toBeDefined();
    expect(await screen.findByText('4')).toBeDefined();
    expect(await screen.findByText('2')).toBeDefined();
    expect(screen.getByText('Festivais cadastrados')).toBeDefined();
    expect(screen.getByText('Festivais abertos')).toBeDefined();
    expect(screen.getByText('Em rascunho')).toBeDefined();
  });
});
