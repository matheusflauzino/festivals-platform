import { LoginForm } from './login-form';
import { BrandMark } from '../../../src/components/brand-mark';
import { Card } from '../../../src/components/ui/card';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="h-14 w-14" />
          <div>
            <h1 className="text-2xl font-semibold text-text">FENAC</h1>
            <p className="text-sm text-text-muted">Área Administrativa</p>
          </div>
        </div>
        <Card className="p-6">
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}
