import { Link } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import { en } from '../strings/en';
import { useTitle } from '../lib/useTitle';
import { PageHeader } from '../components/ui';

export function NoAccessPage() {
  useTitle(en.app.noAccess);
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title={en.app.noAccess} description={en.app.noAccessBody} />
      {user ? (
        <Link to={homeFor(user)} className="text-accent underline">
          {en.app.backHome}
        </Link>
      ) : null}
    </div>
  );
}
