import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateStageForm } from './create-stage-form';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../../../src/lib/api/festivals';

vi.mock('../../../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../../../src/lib/api/festivals');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CreateStageForm', () => {
  it('submits the form and navigates back to the festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createStage).mockResolvedValue({
      id: 's1',
      festivalId: 'f1',
      name: 'Classificatória',
      order: 1,
      advancementQuota: null,
    });

    renderWithQueryClient(<CreateStageForm festivalId="f1" />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Classificatória');
    await userEvent.type(screen.getByLabelText('Ordem'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Fase' }));

    await waitFor(() =>
      expect(festivalsApi.createStage).toHaveBeenCalledWith('token-1', 'f1', {
        name: 'Classificatória',
        order: 1,
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });
});
