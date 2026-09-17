'use client';

import type { ReactNode } from 'react';
import { Modal } from './modal';
import { Button, type ButtonVariant } from './button';

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  isConfirming?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  isConfirming = false,
  error,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {error && <div className="mb-3 text-sm text-status-closed-fg">{error}</div>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={confirmVariant} loading={isConfirming} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
