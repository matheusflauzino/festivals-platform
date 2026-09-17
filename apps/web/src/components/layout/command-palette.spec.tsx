import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './command-palette';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('CommandPalette', () => {
  it('filters active nav items by the typed query and navigates on click', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    expect(screen.getByText('Festivais')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Digite para buscar uma página…'), {
      target: { value: 'Festi' },
    });

    expect(screen.getByText('Festivais')).toBeDefined();
    expect(screen.queryByText('Dashboard')).toBeNull();

    fireEvent.click(screen.getByText('Festivais'));
    expect(mockPush).toHaveBeenCalledWith('/festivals');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an empty message when nothing matches', () => {
    render(<CommandPalette open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Digite para buscar uma página…'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Nenhuma página encontrada.')).toBeDefined();
  });
});
