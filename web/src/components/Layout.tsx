import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  Gavel,
  Inbox,
  LayoutDashboard,
  LogOut,
  Palette,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Video,
  Briefcase,
} from 'lucide-react';
import { api } from '../api/client';
import type { ClockInfo, Me, NotificationItem } from '../api/types';
import { useAuth, useMe } from '../auth/AuthContext';
import { en } from '../strings/en';
import { cx, formatDate, formatDateTime, roleLabel } from '../lib/format';
import { Button, Dialog } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const I = (C: typeof Bell) => <C size={20} strokeWidth={1.75} aria-hidden />;

export function navFor(user: Me): NavItem[] {
  switch (user.role) {
    case 'COLLEGE':
      return [
        { to: '/college', label: en.nav.applications, icon: I(Inbox), end: true },
        { to: '/college/apply', label: en.nav.apply, icon: I(FilePlus2) },
        { to: '/college/compliance', label: en.nav.compliance, icon: I(ShieldCheck) },
      ];
    case 'OFFICER':
      return [
        { to: '/officer', label: en.nav.actionCenter, icon: I(LayoutDashboard) },
        ...(user.skills.includes('EVC_DESK') ? [{ to: '/evc', label: en.nav.evc, icon: I(Video) }] : []),
        { to: '/availability', label: en.nav.availability, icon: I(CalendarDays) },
      ];
    case 'BUREAU':
      return [
        { to: '/bureau', label: en.nav.bureau, icon: I(Briefcase) },
        { to: '/officer', label: en.nav.actionCenter, icon: I(LayoutDashboard) },
        { to: '/workforce', label: en.nav.workforce, icon: I(UsersRound) },
      ];
    case 'SENIOR':
    case 'SUPER_SENIOR':
    case 'HOD':
      return [
        { to: '/team', label: en.nav.team, icon: I(Users) },
        { to: '/workforce', label: en.nav.workforce, icon: I(UsersRound) },
        { to: '/availability', label: en.nav.availability, icon: I(CalendarDays) },
      ];
    case 'COMMITTEE':
      return [
        { to: '/committee', label: en.nav.committee, icon: I(ClipboardCheck) },
        { to: '/availability', label: en.nav.availability, icon: I(CalendarDays) },
      ];
    case 'AUTHORITY':
      return [{ to: '/authority', label: en.nav.authority, icon: I(Gavel) }];
    case 'ADMIN':
      return [
        { to: '/admin', label: en.nav.admin, icon: I(Settings) },
        { to: '/styleguide', label: en.nav.styleguide, icon: I(Palette) },
      ];
    default:
      return [];
  }
}

export function useClock() {
  return useQuery({ queryKey: ['clock'], queryFn: () => api.get<ClockInfo>('/demo/clock'), refetchInterval: 30_000 });
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ unread: number; items: NotificationItem[] }>('/notifications'),
    refetchInterval: 20_000,
  });
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const unread = q.data?.unread ?? 0;
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-label={`${en.app.notifications}${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="hit relative inline-flex h-control w-control items-center justify-center rounded text-secondary hover:bg-subtle hover:text-primary"
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden />
        {unread > 0 ? (
          <span className="tnum absolute right-0.5 top-0.5 min-w-target rounded bg-danger px-1 text-center text-xs font-medium text-white" aria-hidden>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-dialog max-w-viewport animate-rise rounded-lg border bg-surface shadow-overlay" role="region" aria-label={en.app.notifications}>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-semibold">{en.app.notifications}</h2>
            <Button
              size="sm"
              variant="tertiary"
              disabled={unread === 0}
              onClick={async () => {
                await api.post('/notifications/read', {});
                qc.invalidateQueries({ queryKey: ['notifications'] });
              }}
            >
              Mark all as read
            </Button>
          </div>
          <ul className="max-h-table overflow-auto">
            {(q.data?.items ?? []).length === 0 ? <li className="px-4 py-6 text-base text-secondary">You have no notifications.</li> : null}
            {(q.data?.items ?? []).map((n) => (
              <li key={n.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  className={cx('hit block w-full px-4 py-3 text-left hover:bg-subtle', !n.read && 'bg-accent-soft')}
                  onClick={async () => {
                    await api.post('/notifications/read', { ids: [n.id] });
                    qc.invalidateQueries({ queryKey: ['notifications'] });
                    setOpen(false);
                    if (n.applicationId) navigate(`/cases/${n.applicationId}`);
                  }}
                >
                  <span className="block text-base text-primary">{n.message}</span>
                  <span className="tnum mt-1 block text-xs text-muted">
                    {n.applicationNo ? <span className="id-text mr-2">{n.applicationNo}</span> : null}
                    {formatDateTime(n.createdAt)}
                    {!n.read ? <span className="ml-2 font-medium text-accent">Unread</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SessionWarning() {
  const { expiresAt, refresh, logout } = useAuth();
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = expiresAt - Date.now();
      if (left <= 0) logout();
      else setShow(left <= 120_000);
    };
    tick();
    const t = setInterval(tick, 5_000);
    return () => clearInterval(t);
  }, [expiresAt, logout]);
  return (
    <Dialog
      open={show}
      title={en.app.sessionExpiring}
      onClose={() => setShow(false)}
      footer={
        <>
          <Button onClick={logout}>{en.app.signOut}</Button>
          <Button
            variant="primary"
            pending={pending}
            onClick={async () => {
              setPending(true);
              try {
                await refresh();
                setShow(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {en.app.staySignedIn}
          </Button>
        </>
      }
    >
      <p className="text-base text-secondary">{en.app.sessionExpiringBody}</p>
    </Dialog>
  );
}

export function Layout() {
  const user = useMe();
  const { logout } = useAuth();
  const clock = useClock();
  const navigate = useNavigate();
  const items = navFor(user);
  return (
    <div className="min-h-screen bg-page">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-accent">
        {en.app.skip}
      </a>
      <header className="fixed inset-x-0 top-0 z-30 flex h-topbar items-center justify-between gap-4 border-b bg-surface px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Building2 size={20} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
          <span className="truncate text-lg font-semibold">{en.app.name}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {clock.data ? (
            <span className={cx('tnum hidden whitespace-nowrap text-sm sm:inline', clock.data.simulated ? 'rounded bg-warning-soft px-2 py-0.5 font-medium text-warning' : 'text-secondary')}>
              {clock.data.simulated ? `${en.app.simulatedDate}: ` : `${en.app.today}: `}
              {formatDate(clock.data.today)}
            </span>
          ) : null}
          <NotificationBell />
          <div className="hidden text-right md:block">
            <p className="text-base font-medium leading-tight">{user.name}</p>
            <p className="text-xs text-secondary">
              {roleLabel(user.role)}
              {user.regionCode ? `, ${user.regionCode === 'SOUTH' ? 'South' : 'West'}` : ''}
            </p>
          </div>
          <Button
            size="sm"
            variant="tertiary"
            icon={<LogOut size={16} strokeWidth={1.75} aria-hidden />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            {en.app.signOut}
          </Button>
        </div>
      </header>
      <nav aria-label="Main" className="fixed bottom-0 left-0 top-topbar z-20 w-12 border-r bg-surface pt-4 lg:w-sidebar">
        <ul className="flex flex-col gap-1 px-1 lg:px-3">
          {items.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.end}
                title={it.label}
                className={({ isActive }) =>
                  cx(
                    'hit flex h-control items-center gap-3 rounded px-2 text-base transition-colors duration-150 ease-out lg:px-3',
                    isActive ? 'bg-accent-soft font-semibold text-accent' : 'font-medium text-secondary hover:bg-subtle hover:text-primary',
                  )
                }
              >
                {it.icon}
                <span className="sr-only lg:not-sr-only">{it.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" tabIndex={-1} className="pl-12 pt-topbar lg:pl-sidebar">
        <div className="max-w-content p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
      <SessionWarning />
    </div>
  );
}
