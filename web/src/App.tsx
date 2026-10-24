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
        <Route path="/college" element={<RequireRole roles={['COLLEGE']}><PlaceholderPage title="My applications" description="Your institution's applications and what AICTE needs from you." /></RequireRole>} />
        <Route path="/officer" element={<RequireRole roles={['OFFICER', 'BUREAU']}><PlaceholderPage title="Action Center" description="Cases that need your action, in priority order." /></RequireRole>} />
        <Route path="/evc" element={<RequireRole roles={['OFFICER', 'BUREAU']}><PlaceholderPage title="EVC desk" description="Applications waiting for an expert visit to be scheduled." /></RequireRole>} />
        <Route path="/committee" element={<RequireRole roles={['COMMITTEE']}><PlaceholderPage title="Committee" description="Your visits, reports due and SAC/SHC cases." /></RequireRole>} />
        <Route path="/authority" element={<RequireRole roles={['AUTHORITY']}><PlaceholderPage title="Decisions" description="Applications waiting for your decision." /></RequireRole>} />
        <Route path="/bureau" element={<RequireRole roles={['BUREAU']}><PlaceholderPage title="Bureau" description="Overflow tasks and SAC/SHC forwarding." /></RequireRole>} />
        <Route path="/team" element={<RequireRole roles={MANAGERS}><PlaceholderPage title="Team" description="Work done and pending across your team." /></RequireRole>} />
        <Route path="/workforce" element={<RequireRole roles={[...MANAGERS, 'BUREAU']}><PlaceholderPage title="Workforce" description="Officer load, availability and portfolios." /></RequireRole>} />
        <Route path="/availability" element={<RequireRole roles={['OFFICER', 'COMMITTEE', ...MANAGERS]}><PlaceholderPage title="Availability" description="Leave, training and other periods when work is not assigned." /></RequireRole>} />
        <Route path="/admin" element={<RequireRole roles={['ADMIN']}><PlaceholderPage title="Administration" description="Demo controls, audit log and directory." /></RequireRole>} />
        <Route path="/styleguide" element={<RequireRole roles={['ADMIN']}><StyleguidePage /></RequireRole>} />
        <Route path="*" element={<NoAccessPage />} />
      </Route>
    </Routes>
  );
}
