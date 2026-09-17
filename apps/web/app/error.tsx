'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Button } from '../src/components/ui/button';
import { BrandMark } from '../src/components/brand-mark';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <BrandMark className="h-10 w-10 opacity-60" />
      <h2 className="text-lg font-semibold text-text">Algo deu errado.</h2>
      <p className="text-sm text-text-muted">Ocorreu um erro inesperado. Você pode tentar novamente.</p>
      <Button onClick={() => reset()}>Tentar novamente</Button>
    </div>
  );
}
