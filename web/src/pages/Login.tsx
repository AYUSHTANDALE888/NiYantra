// Home and sign in: Official AICTE theme alignment.
// Hero banner with sky-blue atmospheric gradient, dual glass cards with cyan borders,
// golden action pills, institutional single-window access, and demo persona switchers.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, BookOpen, LifeBuoy, ListChecks, MessageSquare, Phone, Search, Sparkles, UserCheck } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { DemoUser, Role } from '../api/types';
import { homeFor, useAuth } from '../auth/AuthContext';
import { useT } from '../lib/prefs';
import { formatDate, roleLabel } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { Button, ErrorSummary, Field, Input } from '../components/ui';
import { Monogram, useCurrentRules } from '../components/shell/Shell';
import { KIND_LABEL, type PublicNotice, type PublicScheduleRow } from './rules/types';

const ROLE_ORDER: Role[] = ['COLLEGE', 'OFFICER', 'SENIOR', 'SUPER_SENIOR', 'HOD', 'BUREAU', 'COMMITTEE', 'AUTHORITY', 'ADMIN', 'RULE_EDITOR', 'RULE_APPROVER'];

function LoginCard() {
  const t = useT();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trackId, setTrackId] = useState('');
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const demo = useQuery({ queryKey: ['demo-users'], queryFn: () => api.get<{ users: DemoUser[] }>('/auth/demo-users'), retry: false });

  useEffect(() => {
    if (errors.length) summary.current?.focus();
  }, [errors]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { field: string; message: string }[] = [];
    if (!email.trim()) errs.push({ field: 'email', message: t.login.emailRequired });
    if (!password) errs.push({ field: 'password', message: t.login.passwordRequired });
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

  function handleTrackSubmit(e: FormEvent) {
    e.preventDefault();
    if (trackId.trim()) {
      navigate(`/track?applicationNo=${encodeURIComponent(trackId.trim())}`);
    }
  }

  const groups = ROLE_ORDER.map((r) => ({ role: r, users: (demo.data?.users ?? []).filter((u) => u.role === r) })).filter((g) => g.users.length);
  const fieldError = (f: string) => errors.find((e) => e.field === f)?.message ?? null;

  // Key demo quick-pick targets
  const quickPicks = [
    { label: 'College', email: 'college.abc@demo.in', role: 'COLLEGE' },
    { label: 'Scrutiny Officer', email: 'priya@demo.in', role: 'OFFICER' },
    { label: 'Regional Director', email: 'authority.south@demo.in', role: 'AUTHORITY' },
    { label: 'System Admin', email: 'admin@demo.in', role: 'ADMIN' },
  ];

  return (
    <section
      id="sign-in"
      aria-labelledby="sign-in-title"
      className="rounded-2xl border-2 border-[#7dd3fc] bg-white/95 p-6 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
        <Monogram size={52} className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 drop-shadow-sm select-none" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="sign-in-title" className="text-xl md:text-2xl font-bold text-[#0d2b6b] tracking-tight">
              Institutional Single-Window Access
            </h2>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-[#0d2b6b] border border-sky-200">
              NiYantra
            </span>
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-secondary">
            Sign in to your AICTE Approval & Compliance Account
          </p>
        </div>
      </div>

      <form className="mt-4 flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <ErrorSummary ref={summary} errors={errors} title={t.login.errorSummary} />
        <Field id="email" label="Username / Email ID" error={fieldError('email')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              placeholder="e.g. college.abc@demo.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              className="rounded-lg border-gray-300 focus:border-[#0d2b6b] focus:ring-[#0d2b6b]"
            />
          )}
        </Field>
        <Field id="password" label={t.login.password} error={fieldError('password')}>
          {({ id, describedBy, invalid }) => (
            <Input
              ref={passwordRef}
              id={id}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              className="rounded-lg border-gray-300 focus:border-[#0d2b6b] focus:ring-[#0d2b6b]"
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="gold"
          pending={pending}
          pendingLabel={t.login.signingIn}
          className="w-full py-2.5 text-base font-semibold"
        >
          {t.login.signIn}
        </Button>
      </form>

      {/* Quick Demo Persona Switcher */}
      <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50/60 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#0d2b6b] uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck size={14} className="text-amber-600" />
            Quick Demo Persona Switcher:
          </span>
          <span className="text-[11px] text-muted">Click to auto-fill</span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quickPicks.map((p) => (
            <button
              key={p.email}
              type="button"
              onClick={() => {
                setEmail(p.email);
                setPassword('demo1234');
                passwordRef.current?.focus();
              }}
              className="hit flex flex-col items-center justify-center rounded-lg border border-sky-200 bg-white p-2 text-center text-xs font-medium text-gray-800 shadow-2xs transition-all hover:border-amber-500 hover:bg-amber-50/50 hover:text-amber-900"
            >
              <span className="font-semibold text-[#0d2b6b] truncate w-full">{p.label}</span>
              <span className="text-[10px] text-muted truncate w-full">{p.email.split('@')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Track Application Form */}
      <div className="mt-5 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Search size={15} className="text-[#0d2b6b]" />
          Track Application Status
        </h3>
        <form onSubmit={handleTrackSubmit} className="mt-2 flex gap-2">
          <Input
            id="quick-track"
            placeholder="Enter Application ID (e.g. APP-2027-SOUTH-0042)"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            className="flex-1 rounded-full text-xs border-gray-300"
          />
          <button
            type="submit"
            className="hit inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-5 text-xs font-semibold text-white shadow-sm hover:from-amber-600 hover:to-amber-700"
          >
            Find
          </button>
        </form>
      </div>

      {/* Extended demo roles drawer if needed */}
      {groups.length ? (
        <details className="mt-4 border-t border-gray-100 pt-3 text-xs text-secondary">
          <summary className="cursor-pointer font-medium text-[#0d2b6b] hover:underline">
            View All Demo Roles ({demo.data?.users.length ?? 0} accounts)
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto flex flex-col gap-2 p-1">
            {groups.map((g) => (
              <div key={g.role}>
                <span className="font-semibold text-gray-700">{t.roles[g.role] ?? roleLabel(g.role)}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.users.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => {
                        setEmail(u.email);
                        setPassword('demo1234');
                        passwordRef.current?.focus();
                      }}
                      className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] hover:border-amber-500 hover:bg-amber-50"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SignedInCard() {
  const t = useT();
  const { user } = useAuth();
  return (
    <section className="rounded-2xl border-2 border-[#7dd3fc] bg-white/95 p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
        <Monogram size={48} className="h-12 w-12 shrink-0 drop-shadow-sm select-none" />
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-[#0d2b6b]">{user!.name}</h2>
          <p className="mt-0.5 text-sm text-secondary">{t.roles[user!.role] ?? roleLabel(user!.role)}</p>
        </div>
      </div>
      <Link
        to={homeFor(user!)}
        className="hit mt-5 inline-flex h-control items-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-6 text-sm font-semibold text-white shadow-sm hover:from-amber-600 hover:to-amber-700"
      >
        {t.app.backHome}
      </Link>
    </section>
  );
}

function Tile({ to, icon, label, desc }: { to: string; icon: ReactNode; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="hit flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 no-underline shadow-2xs transition-all hover:border-[#0d2b6b] hover:shadow-md"
    >
      <span className="text-[#0d2b6b]">{icon}</span>
      <span className="text-base font-bold text-gray-900">{label}</span>
      <span className="text-xs text-secondary">{desc}</span>
    </Link>
  );
}

export function LoginPage() {
  const t = useT();
  useTitle(t.publicNav.home);
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const cur = useCurrentRules();
  const schedule = useQuery({ queryKey: ['public', 'schedule'], queryFn: () => api.get<{ schedule: PublicScheduleRow[] }>('/rules/public/schedule') });
  const notices = useQuery({ queryKey: ['public', 'notices'], queryFn: () => api.get<{ notices: PublicNotice[] }>('/rules/public/notices') });

  useEffect(() => {
    if (user && loc.pathname === '/login') navigate(homeFor(user), { replace: true });
  }, [user, loc.pathname, navigate]);

  const current = cur.data?.cycle;
  const rows = (schedule.data?.schedule ?? []).filter((s) => !current || s.cycle === current);

  return (
    <div className="flex flex-col">
      {/* Hero Atmosphere Banner matching AICTE Official Theme with Left-aligned Emblem */}
      <div className="border-b border-sky-200 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-[#f4f6f9] py-6 shadow-inner">
        <div className="mx-auto flex max-w-content flex-col md:flex-row items-center md:items-center justify-between gap-6 px-4">
          <div className="flex items-center gap-4 text-left">
            <Monogram size={64} className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 drop-shadow-md select-none" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#0d2b6b]">
                  Approval Process 2027–2028
                </h1>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300 shadow-2xs">
                  Single-Window Portal Open
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-[#0369a1]">
                w.e.f. 28th Nov, 2026 · NiYantra — Integrated AICTE Approval Workflow, Compliance Monitoring & Verification System
              </p>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end gap-1.5 shrink-0 text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              AICTE Problem Statement
            </span>
            <span className="rounded-lg bg-[#0d2b6b] px-3 py-1.5 text-xs font-bold text-white shadow-2xs">
              SIH 2026 · PS SIH26262
            </span>
          </div>
        </div>
      </div>

      {/* Main Dual Cards Grid */}
      <div className="mx-auto grid max-w-content grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-12">
        {/* Left Column: Approval Schedule & Statutory Guidelines Card */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <section
            aria-labelledby="cycle"
            className="rounded-2xl border-2 border-[#7dd3fc] bg-white/95 p-6 shadow-xl backdrop-blur-md"
          >
            <div className="border-b border-gray-100 pb-3">
              <h2 id="cycle" className="text-xl md:text-2xl font-bold text-[#0d2b6b]">
                Approval Schedule & Guidelines
              </h2>
              <p className="mt-1 text-sm text-secondary">
                Official calendar and statutory deadlines under AICTE Approval Process Handbook (APH)
              </p>
            </div>

            <div className="mt-4 overflow-x-auto" role="region" aria-label={t.notices.schedule} tabIndex={0}>
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t.notices.schedule}</caption>
                <thead className="bg-[#0d2b6b] text-white">
                  <tr>
                    <th scope="col" className="rounded-l-lg py-2.5 px-3 font-semibold">Filing Window</th>
                    <th scope="col" className="py-2.5 px-3 font-semibold">From Date</th>
                    <th scope="col" className="py-2.5 px-3 font-semibold">To Date</th>
                    <th scope="col" className="rounded-r-lg py-2.5 px-3 font-semibold">Applies To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((s, idx) => (
                    <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-sky-50/30'}>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{s.label}</td>
                      <td className="tnum whitespace-nowrap py-2.5 px-3 text-secondary">{formatDate(s.from)}</td>
                      <td className="tnum whitespace-nowrap py-2.5 px-3 text-secondary">{formatDate(s.to)}</td>
                      <td className="py-2.5 px-3 text-xs text-muted">{s.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action pill buttons matching the AICTE portal reference image */}
            <div className="mt-5 flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/process"
                className="hit inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:from-amber-600 hover:to-amber-700"
              >
                Download APH Handbook
              </Link>
              <Link
                to="/notices"
                className="hit inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:from-amber-600 hover:to-amber-700"
              >
                View Cycle Notices
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 border border-amber-200">
                <Phone size={13} className="text-amber-700" />
                Technical Helpline: (011) 29581333, 29581338
              </span>
            </div>
          </section>

          {/* Recent Regulatory Changes & Circulars */}
          {(notices.data?.notices ?? []).length > 0 ? (
            <section aria-labelledby="recent" className="rounded-2xl border border-sky-100 bg-white p-5 shadow-xs">
              <div className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
                <h2 id="recent" className="text-base font-bold text-[#0d2b6b] flex items-center gap-1.5">
                  <Bell size={16} className="text-amber-500" />
                  Recent Statutory Circulars & Handbooks
                </h2>
                <Link to="/notices" className="text-xs font-semibold text-[#0d2b6b] hover:underline">
                  View All ({notices.data?.notices.length})
                </Link>
              </div>
              <ul className="mt-2 divide-y divide-gray-100">
                {(notices.data?.notices ?? []).slice(0, 3).map((n) => (
                  <li key={n.versionId} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-xs">
                    <div>
                      <span className="font-semibold text-gray-900 block">{n.title}</span>
                      <span className="text-muted">
                        {KIND_LABEL[n.kind] ?? n.kind} · Ref: {n.refNo} · {formatDate(n.issuedOn)}
                      </span>
                    </div>
                    <Link to="/notices" className="font-semibold text-[#0d2b6b] hover:underline">
                      Read Circular →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Quick Access Services */}
          <section aria-labelledby="quick">
            <h2 id="quick" className="mb-3 text-lg font-bold text-[#0d2b6b] flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              Quick Citizen & Institutional Services
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile to="/process" icon={<ListChecks size={20} aria-hidden />} label={t.publicNav.process} desc={t.home.processDesc} />
              <Tile to="/notices" icon={<BookOpen size={20} aria-hidden />} label={t.publicNav.changed} desc={t.home.changedDesc} />
              <Tile to="/track" icon={<Search size={20} aria-hidden />} label={t.publicNav.track} desc={t.home.trackDesc} />
              <Tile to="/help" icon={<LifeBuoy size={20} aria-hidden />} label={t.publicNav.help} desc={t.home.helpDesc} />
            </div>
          </section>
        </div>

        {/* Right Column: Institutional Single-Window Access */}
        <div className="lg:col-span-5">{user ? <SignedInCard /> : <LoginCard />}</div>
      </div>

      {/* Floating Interactive AI Assistant Avatar Widget */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <div className="hidden sm:block rounded-xl border border-sky-200 bg-white px-3.5 py-1.5 text-xs font-medium text-[#0d2b6b] shadow-lg">
          Need Help? Chat with NiYantra Assistant
        </div>
        <Link
          to="/help"
          title="NiYantra Interactive Virtual Assistant"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0d2b6b] text-amber-400 shadow-xl ring-4 ring-sky-100 transition-transform hover:scale-105"
        >
          <MessageSquare size={22} />
        </Link>
      </div>
    </div>
  );
}
