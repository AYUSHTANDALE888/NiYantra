import { useTitle } from '../lib/useTitle';
import { Card, EmptyState, PageHeader } from '../components/ui';

/** Phase 0 landing page for a role; replaced by the real screen in later phases. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  useTitle(title);
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState message="There is nothing here yet." />
      </Card>
    </div>
  );
}
