import { Link } from 'react-router-dom';
import type { ListRow } from '../../api/types';
import { Card, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';

/** "What we need from you": items the college owns. Phase 3 feeds this from Action Center flags. */
export function NeedsFromYou({ rows }: { rows: ListRow[] | undefined }) {
  const returned = (rows ?? []).filter((r) => r.status === 'RETURNED');
  return (
    <Card title="What we need from you">
      {returned.length === 0 ? (
        <p className="text-base text-secondary">Nothing is waiting on you right now.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {returned.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-base font-medium">
                  <span className="id-text">{r.applicationNo}</span> was returned with a deficiency
                </p>
                <p className="text-sm text-secondary">Reply with the items asked for. The scrutiny clock is paused until you do. Submitted {formatDate(r.submittedAt)}.</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge kind="waitingOnCollege" />
                <Link to={`/college/applications/${r.id}`} className="hit inline-flex h-control-sm items-center rounded border border-input bg-surface px-3 text-sm font-medium hover:bg-subtle">
                  Reply to deficiency
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
