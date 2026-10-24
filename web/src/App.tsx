import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Role } from './api/types';
import { homeFor, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Skeleton } from './components/ui';
import { LoginPage } from './pages/Login';
import { NoAccessPage } from './pages/NoAccess';
import { StyleguidePage } from './pages/Styleguide';
import { PlaceholderPage } from './pages/Placeholder';
import { CollegeHomePage } from './pages/college/CollegeHome';
import { ApplyPage } from './pages/college/Apply';
import { CollegeCasePage } from './pages/college/CollegeCase';
import { OfficerHomePage } from './pages/officer/OfficerHome';
import { CaseViewPage } from './pages/CaseView';
import { AuthorityQueuePage, BureauQueuePage, CommitteeQueuePage, EvcQueuePage } from './pages/Queues';
import { AvailabilityPage } from './pages/Availability';

const MANAGERS: Role[] = ['SENIOR', 'SUPER_SENIOR', 'HOD'];

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <NoAccessPage />;
  return <>{children}</>;
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="p-6">
        <Skeleton lines={4} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route index element={<Home />} />
        <Route path="/college" element={<RequireRole roles={['COLLEGE']}><CollegeHomePage /></RequireRole>} />
        <Route path="/college/apply" element={<RequireRole roles={['COLLEGE']}><ApplyPage /></RequireRole>} />
        <Route path="/college/applications/:id" element={<RequireRole roles={['COLLEGE']}><CollegeCasePage /></RequireRole>} />
        <Route path="/college/compliance" element={<RequireRole roles={['COLLEGE']}><PlaceholderPage title="Compliance" description="Undertakings and documents with expiry dates." /></RequireRole>} />
        <Route path="/cases/:id" element={<CaseViewPage />} />
        <Route path="/officer" element={<RequireRole roles={['OFFICER', 'BUREAU']}><OfficerHomePage /></RequireRole>} />
        <Route path="/evc" element={<RequireRole roles={['OFFICER', 'BUREAU']}><EvcQueuePage /></RequireRole>} />
        <Route path="/committee" element={<RequireRole roles={['COMMITTEE']}><CommitteeQueuePage /></RequireRole>} />
        <Route path="/authority" element={<RequireRole roles={['AUTHORITY']}><AuthorityQueuePage /></RequireRole>} />
        <Route path="/bureau" element={<RequireRole roles={['BUREAU']}><BureauQueuePage /></RequireRole>} />
        <Route path="/team" element={<RequireRole roles={MANAGERS}><PlaceholderPage title="Team" description="Work done and pending across your team." /></RequireRole>} />
        <Route path="/workforce" element={<RequireRole roles={[...MANAGERS, 'BUREAU']}><PlaceholderPage title="Workforce" description="Officer load, availability and portfolios." /></RequireRole>} />
        <Route path="/availability" element={<RequireRole roles={['OFFICER', 'COMMITTEE', ...MANAGERS]}><AvailabilityPage /></RequireRole>} />
        <Route path="/admin" element={<RequireRole roles={['ADMIN']}><PlaceholderPage title="Administration" description="Demo controls, audit log and directory." /></RequireRole>} />
        <Route path="/styleguide" element={<RequireRole roles={['ADMIN']}><StyleguidePage /></RequireRole>} />
        <Route path="*" element={<NoAccessPage />} />
      </Route>
    </Routes>
  );
}
