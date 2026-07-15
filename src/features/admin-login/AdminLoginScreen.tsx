import { useState, type FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useAdminAuth } from '../../app/auth/AdminAuthContext';
import { AdminAuthError } from '../../app/auth/adminAuth';
import { Button } from '../../design-system/components/Button';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import { PageHeader } from '../../design-system/components/PageHeader';

export function AdminLoginScreen() {
  const { login, status } = useAdminAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (caughtError) {
      setError(
        caughtError instanceof AdminAuthError ? caughtError.message : 'Não foi possível acessar a área administrativa.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page width="narrow" className="items-center justify-center">
      <div className="w-full max-w-md">
        <PageHeader
          title="Acesso administrativo"
          description="Entre com uma conta autorizada para gerenciar o conteúdo do SeCuida."
          icon={<LockKeyhole className="text-primary" size={36} aria-hidden="true" />}
          align="center"
        />
        <Card className="mt-stack-md p-6 md:p-8">
          <form className="flex flex-col gap-5" onSubmit={submit}>
            <label className="flex flex-col gap-2 font-label-md text-on-surface" htmlFor="admin-email">
              E-mail
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="min-h-12 rounded-lg border border-outline-variant bg-surface px-4 font-body-md"
              />
            </label>
            <label className="flex flex-col gap-2 font-label-md text-on-surface" htmlFor="admin-password">
              Senha
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-12 rounded-lg border border-outline-variant bg-surface px-4 font-body-md"
              />
            </label>
            {status === 'unavailable' && !error ? (
              <p role="alert" className="rounded-lg bg-error-container p-3 text-on-error-container">
                A autenticação administrativa não está configurada ou está indisponível.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-lg bg-error-container p-3 text-on-error-container">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting || status === 'unavailable'} className="w-full">
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
