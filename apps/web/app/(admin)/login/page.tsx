import { LoginForm } from './login-form';
import { BrandMark } from '../../../src/components/brand-mark';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mist p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="h-14 w-14" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">FENAC</h1>
            <p className="text-sm text-graphite">Área Administrativa</p>
          </div>
        </div>
        <div className="rounded-xl border border-sky bg-white p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
