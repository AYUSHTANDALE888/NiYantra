import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '../api/client';
import type { FormCheckView } from '../api/types';
import { formatDateTime } from '../lib/format';
import { Badge, Button, Card, EmptyState, WarningList } from './ui';

export function FormChecksPanel({ checks, applicationId, canLabel }: { checks: FormCheckView[]; applicationId: string; canLabel: boolean }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const latest = checks[0];
  return (
    <Card title="Form checks">
      {!latest ? (
        <EmptyState message="No form checks were stored for this application." />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
            <Badge tone={latest.severity === 'HIGH' ? 'danger' : latest.severity === 'MEDIUM' ? 'warning' : 'success'}>
              {latest.severity === 'NONE' ? 'No warnings' : latest.severity === 'HIGH' ? 'High' : 'Medium'}
            </Badge>
            <span>{latest.modelAvailable ? `Model ${latest.modelVersion}` : 'Model unavailable, rules only'}</span>
            <span className="tnum">· {formatDateTime(latest.createdAt)}</span>
          </div>
          <p className="text-xs text-muted">Advisory only. It never blocks filing or changes routing, deadlines or assignment.</p>
          <WarningList
            warnings={latest.warnings}
            renderExtra={(_, i) => {
              const label = latest.officerLabels[String(i)];
              return (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {label ? <span className="text-xs text-secondary">Marked {label.useful ? 'useful' : 'not useful'} by {label.byName}</span> : null}
                  {canLabel ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<ThumbsUp size={16} aria-hidden />}
                        pending={pending === `${i}-1`}
                        aria-pressed={label?.useful === true}
                        onClick={async () => {
                          setPending(`${i}-1`);
                          await api.post(`/form-checks/${latest.id}/label`, { warningIndex: i, useful: true }).finally(() => setPending(null));
                          qc.invalidateQueries({ queryKey: ['case', applicationId] });
                        }}
                      >
                        Useful
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<ThumbsDown size={16} aria-hidden />}
                        pending={pending === `${i}-0`}
                        aria-pressed={label?.useful === false}
                        onClick={async () => {
                          setPending(`${i}-0`);
                          await api.post(`/form-checks/${latest.id}/label`, { warningIndex: i, useful: false }).finally(() => setPending(null));
                          qc.invalidateQueries({ queryKey: ['case', applicationId] });
                        }}
                      >
                        Not useful
                      </Button>
                    </>
                  ) : null}
                </div>
              );
            }}
          />
          {latest.justification ? (
            <div className="rounded-lg border bg-page p-3">
              <h3 className="text-sm font-semibold text-secondary">College's justification</h3>
              <p className="mt-1 text-base">{latest.justification}</p>
            </div>
          ) : null}
          {checks.length > 1 ? <p className="text-xs text-muted">{checks.length - 1} earlier checks on this draft are stored in the history.</p> : null}
        </div>
      )}
    </Card>
  );
}
