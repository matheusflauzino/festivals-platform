'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Algo deu errado.</h2>
      <p className="text-sm text-gray-500">
        Ocorreu um erro inesperado. Você pode tentar novamente.
      </p>
      <button
        onClick={() => reset()}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
      >
        Tentar novamente
      </button>
    </div>
  );
}
