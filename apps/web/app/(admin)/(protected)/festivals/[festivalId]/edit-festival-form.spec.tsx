import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditFestivalForm } from './edit-festival-form';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../src/lib/api/festivals';
import type { Festival } from '../../../../../src/lib/api/festivals';

vi.mock('../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const festival: Festival = {
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
};

describe('EditFestivalForm', () => {
  it('pre-fills the form with the current festival data', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithQueryClient(<EditFestivalForm festival={festival} open onOpenChange={vi.fn()} />);

    // react-hook-form's `values` option repopulates the form in an effect
    // after mount, not synchronously during the first render — wait for it
    // rather than asserting immediately.
    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveProperty('value', 'FENAC 2026'));
    expect(screen.getByLabelText('Valor da inscrição')).toHaveProperty('value', '25');
  });

  it('submits the edited values, calls updateFestival and closes the modal', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.updateFestival).mockResolvedValue({ ...festival, name: 'FENAC 2026 (editado)' });
    const onOpenChange = vi.fn();

    renderWithQueryClient(<EditFestivalForm festival={festival} open onOpenChange={onOpenChange} />);

    const nameInput = screen.getByLabelText('Nome');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'FENAC 2026 (editado)');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() =>
      expect(festivalsApi.updateFestival).toHaveBeenCalledWith(
        'token-1',
        'f1',
        expect.objectContaining({ name: 'FENAC 2026 (editado)', inscriptionFee: 25 }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    // Regression check: the date fields were never touched by the user, so the
    // submitted registrationBegin/registrationEnd must round-trip to the exact
    // same UTC instant as the original fixture — not shifted by the local
    // timezone offset (see toDateTimeLocal in edit-festival-form.tsx).
    const [, , submittedValues] = vi.mocked(festivalsApi.updateFestival).mock.calls[0];
    expect(new Date(submittedValues.registrationBegin).getTime()).toBe(
      new Date(festival.registrationBegin).getTime(),
    );
    expect(new Date(submittedValues.registrationEnd).getTime()).toBe(new Date(festival.registrationEnd).getTime());
  });

  it('pre-fills the date inputs with the correct local-time digits (round-trips to the same UTC instant)', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithQueryClient(<EditFestivalForm festival={festival} open onOpenChange={vi.fn()} />);

    function toLocalDateTimeDigits(isoString: string): string {
      const date = new Date(isoString);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    }

    await waitFor(() =>
      expect(screen.getByLabelText('Início das inscrições')).toHaveProperty(
        'value',
        toLocalDateTimeDigits(festival.registrationBegin),
      ),
    );
    expect(screen.getByLabelText('Fim das inscrições')).toHaveProperty(
      'value',
      toLocalDateTimeDigits(festival.registrationEnd),
    );
  });
});
