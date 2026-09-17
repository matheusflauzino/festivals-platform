import { BrandMark } from '../src/components/brand-mark';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-mist">
      <BrandMark className="h-12 w-12" />
      <h1 className="font-display text-2xl font-semibold text-ink">FENAC Platform</h1>
    </main>
  );
}
