import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Spending = lazy(() => import('@/pages/Spending'));
const Monthly = lazy(() => import('@/pages/Monthly'));
const Projections = lazy(() => import('@/pages/Projections'));
const Settings = lazy(() => import('@/pages/Settings'));
const Import = lazy(() => import('@/pages/Import'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse text-primary text-sm">Loading...</div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/spending" element={<Spending />} />
                      <Route path="/monthly" element={<Monthly />} />
                      <Route path="/projections" element={<Projections />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/import" element={<Import />} />
                    </Routes>
                  </Suspense>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
