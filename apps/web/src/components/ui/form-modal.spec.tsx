import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormModal } from './form-modal';

describe('FormModal', () => {
  it('calls onSubmit when the form is submitted', () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <FormModal open onOpenChange={vi.fn()} title="Novo Item" onSubmit={onSubmit} submitLabel="Criar">
        <input aria-label="Nome" />
      </FormModal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('calls onOpenChange(false) when Cancelar is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <FormModal open onOpenChange={onOpenChange} title="Novo Item" onSubmit={vi.fn()}>
        <input aria-label="Nome" />
      </FormModal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables the submit button while isSubmitting', () => {
    render(
      <FormModal open onOpenChange={vi.fn()} title="Novo Item" onSubmit={vi.fn()} isSubmitting submitLabel="Criar">
        <input aria-label="Nome" />
      </FormModal>,
    );
    expect(screen.getByRole('button', { name: 'Criar' })).toHaveProperty('disabled', true);
  });
});
