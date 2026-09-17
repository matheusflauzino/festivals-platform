'use client';

import type { FormEvent, ReactNode } from 'react';
import { Modal } from './modal';
import { Button } from './button';

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  children,
}: FormModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {children}
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
