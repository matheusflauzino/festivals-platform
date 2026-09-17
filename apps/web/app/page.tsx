import { BrandMark } from '../src/components/brand-mark';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <BrandMark className="h-12 w-12" />
      <h1 className="text-2xl font-semibold text-text">FENAC Platform</h1>
    </main>
  );
}
