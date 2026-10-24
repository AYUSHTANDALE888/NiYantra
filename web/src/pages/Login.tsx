import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { DemoUser, Role } from '../api/types';
import { homeFor, useAuth } from '../auth/AuthContext';
import { en } from '../strings/en';
import { roleLabel } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { Button, ErrorSummary, Field, Input } from '../components/ui';

const ROLE_ORDER: Role[] = ['COLLEGE', 'OFFICER', 'SENIOR', 'SUPER_SENIOR', 'HOD', 'BUREAU', 'COMMITTEE', 'AUTHORITY', 'ADMIN'];

export function LoginPage() {
  useTitle('Sign in');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const demo = useQuery({ queryKey: ['demo-users'], queryFn: () => api.get<{ users: DemoUser[] }>('/auth/demo-users'), retry: false });

  useEffect(() => {
    if (user) navigate(homeFor(user), { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (errors.length) summary.current?.focus();
  }, [errors]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { field: string; message: string }[] = [];
    if (!email.trim()) errs.push({ field: 'email', message: en.login.emailRequired });
    if (!password) errs.push({ field: 'password', message: en.login.passwordRequired });
    setErrors(errs);
    if (errs.length) return;
    setPending(true);
    try {
      const u = await login(email.trim(), password);
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setErrors([{ field: 'email', message: err instanceof ApiError ? err.message : 'Sign-in failed. Try again.' }]);
    } finally {
      setPending(false);
    }
  }

  const groups = ROLE_ORDER.map((r) => ({ role: r, users: (demo.data?.users ?? []).filter((u) => u.role === r) })).filter((g) => g.users.length);
  const fieldError = (f: string) => errors.find((e) => e.field === f)?.message ?? null;

  return (
    <main id="main" className="min-h-screen bg-page px-4 py-12">
      <div className="mx-auto flex max-w-content flex-col gap-8 lg:flex-row lg:items-start">
        <section className="w-full rounded-lg border bg-surface p-6 lg:max-w-dialog">
          <div className="mb-6 flex items-center gap-3">
            <Building2 size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
            <span className="text-lg font-semibold">{en.app.name}</span>
          </div>
          <h1 className="text-2xl font-semibold">{en.login.title}</h1>
          <p className="mt-2 text-base text-secondary">{en.login.description}</p>
          <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
            <ErrorSummary ref={summary} errors={errors} title={en.login.errorSummary} />
            <Field id="email" label={en.login.email} error={fieldError('email')}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={describedBy} invalid={invalid} />
              )}
            </Field>
            <Field id="password" label={en.login.password} error={fieldError('password')}>
              {({ id, describedBy, invalid }) => (
                <Input ref={passwordRef} id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={describedBy} invalid={invalid} />
              )}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" pending={pending} pendingLabel={en.login.signingIn}>
                {en.login.signIn}
              </Button>
            </div>
          </form>
        </section>
        {groups.length ? (
          <section aria-labelledby="demo-users" className="w-full flex-1 rounded-lg border bg-surface p-6">
            <h2 id="demo-users" className="text-lg font-semibold">
              {en.login.demoUsers}
            </h2>
            <p className="mt-1 text-base text-secondary">{en.login.demoHint}</p>
            <div className="mt-4 flex flex-col gap-4">
              {groups.map((g) => (
                <div key={g.role}>
                  <h3 className="text-xs font-semibold text-secondary">{roleLabel(g.role)}</h3>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {g.users.map((u) => (
                      <li key={u.email}>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(u.email);
                            setPassword('demo1234');
                            passwordRef.current?.focus();
                          }}
                          className="hit rounded border border-input bg-surface px-3 py-1 text-left text-sm hover:bg-subtle"
                        >
                          <span className="block font-medium text-primary">{u.institution ?? u.name}</span>
                          <span className="block text-xs text-muted">{u.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
