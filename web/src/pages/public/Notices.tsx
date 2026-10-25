// /notices: "What changed this cycle". Public (no login) and linked from the college dashboard banner.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '../../api/client';
import { Badge, Card, ErrorState, IconButton, PageHeader, Skeleton, Table } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useTitle } from '../../lib/useTitle';
import { KIND_LABEL, cycleLabel, type PublicNotice, type PublicScheduleRow } from '../rules/types';

export function usePublicNotices() {
  return useQuery({ queryKey: ['public', 'notices'], queryFn: () => api.get<{ notices: PublicNotice[]; schedule: PublicScheduleRow[] }>('/rules/public/notices') });
}

const WINDOW_LABEL: Record<string, string> = { APPLICATION_WINDOW: 'Applications', LATE_FEE_WINDOW: 'With late fee', PAYMENT_DEADLINE: 'Payment', DECISION_LAST_DATE: 'Last date for decisions' };

export function NoticesView() {
  const q = usePublicNotices();
  if (q.isLoading) return <Skeleton lines={6} />;
  if (!q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="changes" className="flex flex-col gap-3">
        <h2 id="changes" className="text-xl font-semibold">
          Changes to the rules
        </h2>
        {q.data.notices.map((n) => (
          <Card key={n.versionId} as="div">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{KIND_LABEL[n.kind] ?? n.kind}</Badge>
              <Badge tone={n.current ? 'success' : 'neutral'}>{`${cycleLabel(n.cycle)} · rules v${n.version}${n.current ? ' · in force' : ''}`}</Badge>
            </div>
            <h3 className="mt-2 text-lg font-semibold">{n.title}</h3>
            <p className="mt-1 text-sm text-secondary">
              {n.refNo} · issued {formatDate(n.issuedOn)} · effective {formatDate(n.effectiveFrom)}
            </p>
            <p className="mt-2 text-base">{n.summary}</p>
            <p className="mt-2 text-sm text-secondary">Affects: {n.affectedTypes.join(', ')}</p>
          </Card>
        ))}
      </section>
      <Table
        caption="Application schedule"
        rows={q.data.schedule}
        rowKey={(s) => `${s.cycle}-${s.id}`}
        emptyMessage="No windows are published."
        columns={[
          { key: 'cycle', header: 'Cycle', render: (s) => cycleLabel(s.cycle) },
          { key: 'label', header: 'Window', wrap: true, render: (s) => s.label },
          { key: 'kind', header: 'Kind', render: (s) => WINDOW_LABEL[s.kind] ?? s.kind },
          { key: 'from', header: 'From', render: (s) => formatDate(s.from), sortValue: (s) => s.from },
          { key: 'to', header: 'To', render: (s) => formatDate(s.to), sortValue: (s) => s.to },
          { key: 'scope', header: 'Who', wrap: true, render: (s) => s.scope },
        ]}
      />
      <p className="text-sm text-muted">Values in this prototype are placeholders or modelled on public documents; check the official notices before acting on them.</p>
    </div>
  );
}

export function NoticesPage() {
  useTitle('What changed this cycle');
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <PageHeader title="What changed this cycle" description="Published amendments to the approval rules of the current cycles, newest first, and the application schedule." actions={<Link className="text-accent underline" to="/login">Sign in</Link>} />
      <NoticesView />
    </div>
  );
}

/** Logged-in variant, inside the application layout. */
export function NoticesInAppPage() {
  useTitle('What changed this cycle');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="What changed this cycle" description="Published amendments to the approval rules of the current cycles, newest first, and the application schedule." />
      <NoticesView />
    </div>
  );
}

const seenKey = (userId: string) => `aicte.noticesSeen.${userId}`;

/** "2 changes to the 2027–28 rules since your last visit · View", dismissible per user. */
export function NoticesBanner({ userId }: { userId: string }) {
  const q = usePublicNotices();
  const [seen, setSeen] = useState<string>(() => {
    try {
      return localStorage.getItem(seenKey(userId)) ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      setSeen(localStorage.getItem(seenKey(userId)) ?? '');
    } catch {
      /* storage unavailable */
    }
  }, [userId]);
  const fresh = (q.data?.notices ?? []).filter((n) => n.publishedAt && n.publishedAt > seen);
  if (!fresh.length) return null;
  const cycles = [...new Set(fresh.map((n) => cycleLabel(n.cycle)))];
  const dismiss = () => {
    const latest = fresh.map((n) => n.publishedAt!).sort().at(-1)!;
    try {
      localStorage.setItem(seenKey(userId), latest);
    } catch {
      /* storage unavailable */
    }
    setSeen(latest);
  };
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-2 text-base">
      <p>
        {fresh.length} {fresh.length === 1 ? 'change' : 'changes'} to the {cycles.join(' and ')} rules since your last visit ·{' '}
        <Link to="/college/notices" className="font-medium text-accent underline" onClick={dismiss}>
          View
        </Link>
      </p>
      <IconButton label="Dismiss" icon={<X size={18} aria-hidden />} onClick={dismiss} />
    </div>
  );
}
