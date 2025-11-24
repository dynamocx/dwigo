import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import FullScreenLoader from '@/components/common/FullScreenLoader';
import MainLayout from '@/components/layout/MainLayout';
import AgentPage from '@/pages/AgentPage';
import DealDetailPage from '@/pages/DealDetailPage';
import DealsPage from '@/pages/DealsPage';
import ExplorePage from '@/pages/ExplorePage';
import LoginPage from '@/pages/LoginPage';
import OnboardingPage from '@/pages/OnboardingPage';
import PreferencesPage from '@/pages/PreferencesPage';
import ProfilePage from '@/pages/ProfilePage';
import RegisterPage from '@/pages/RegisterPage';
import RewardsPage from '@/pages/RewardsPage';
import IngestionReviewPage from '@/pages/admin/IngestionReviewPage';

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<DealsPage />} />
        <Route path="deals" element={<DealsPage />} />
        <Route path="deals/:id" element={<DealDetailPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route
          path="preferences"
          element={
            <ProtectedRoute>
              <PreferencesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="admin/ingestion" element={<IngestionReviewPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="onboarding" element={<OnboardingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
