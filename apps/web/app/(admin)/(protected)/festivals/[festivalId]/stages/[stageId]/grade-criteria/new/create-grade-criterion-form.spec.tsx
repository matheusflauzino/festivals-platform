import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateGradeCriterionForm } from './create-grade-criterion-form';
import { useAuth } from '../../../../../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../../../../../src/lib/api/festivals';

vi.mock('../../../../../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../../../../../src/lib/api/festivals');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CreateGradeCriterionForm', () => {
  it('submits the form and navigates back to the festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createGradeCriterion).mockResolvedValue({
      id: 'g1',
      stageId: 's1',
      name: 'Afinação',
      weight: 2,
    });

    renderWithQueryClient(<CreateGradeCriterionForm stageId="s1" festivalId="f1" />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Afinação');
    await userEvent.type(screen.getByLabelText('Peso'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Critério' }));

    await waitFor(() =>
      expect(festivalsApi.createGradeCriterion).toHaveBeenCalledWith('token-1', 's1', {
        name: 'Afinação',
        weight: 2,
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });
});
