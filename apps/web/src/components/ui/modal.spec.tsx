import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onOpenChange={vi.fn()} title="Título">
        conteúdo
      </Modal>,
    );
    expect(screen.queryByText('conteúdo')).toBeNull();
  });

  it('renders the title, description and children when open', () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Título" description="Descrição">
        conteúdo
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Título')).toBeDefined();
    expect(screen.getByText('Descrição')).toBeDefined();
    expect(screen.getByText('conteúdo')).toBeDefined();
  });

  it('calls onOpenChange(false) when the close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Título">
        conteúdo
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Escape is pressed', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Título">
        conteúdo
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when the backdrop is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Título">
        conteúdo
      </Modal>,
    );
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
