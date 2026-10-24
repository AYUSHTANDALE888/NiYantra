import { useState } from 'react';
import { useApplications, useMyLoad } from '../../api/hooks';
import { CaseTable } from '../../components/CaseTable';
import { Card, PageHeader, Tabs, UtilisationBar } from '../../components/ui';
import { useMe } from '../../auth/AuthContext';
import { useTitle } from '../../lib/useTitle';

export function OfficerHomePage() {
  useTitle('My tasks');
  const me = useMe();
  const [tab, setTab] = useState<'tasks'>('tasks');
  const tasks = useApplications({ mine: 'true' });
  const load = useMyLoad();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={me.role === 'BUREAU' ? 'Action Center' : 'Action Center'} description="Cases that need your action. Each task says why it was assigned to you." />
      <Card>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-secondary">Your load</p>
          {load.data ? <UtilisationBar used={load.data.openPoints} capacity={load.data.capacity} /> : null}
        </div>
      </Card>
      <Tabs label="Work views" value={tab} onChange={setTab} tabs={[{ id: 'tasks', label: 'My tasks', count: tasks.data?.rows.length }]}>
        <CaseTable
          caption="My tasks"
          rows={tasks.data?.rows}
          loading={tasks.isLoading}
          error={tasks.error ? (tasks.error as Error).message : null}
          onRetry={() => tasks.refetch()}
          cols={['no', 'institution', 'task', 'stage', 'days', 'status', 'reason']}
          emptyMessage="You have no open tasks."
        />
      </Tabs>
    </div>
  );
}
