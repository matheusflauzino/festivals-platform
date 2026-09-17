'use client';

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
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
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
