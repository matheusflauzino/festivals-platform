import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('disables Anterior on the first page and Próxima on the last page', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Próxima' })).toHaveProperty('disabled', false);
  });

  it('calls onPageChange with the next page number', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
