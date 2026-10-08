import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';

// Layout
import AppLayout from './components/layout/AppLayout';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Admin
import DashboardPage from './pages/admin/DashboardPage';
import SalesPage from './pages/admin/SalesPage';
import CustomersPage from './pages/admin/CustomersPage';
import ProductsPage from './pages/admin/ProductsPage';
import CreditsPage from './pages/admin/CreditsPage';
import SmsQueuePage from './pages/admin/SmsQueuePage';
import UsersPage from './pages/admin/UsersPage';
import AuditLogPage from './pages/admin/AuditLogPage';

// Worker A
import MakeSalePage from './pages/worker-a/MakeSalePage';
import MySalesPage from './pages/worker-a/MySalesPage';
import WorkerAProductsPage from './pages/worker-a/ProductsPage';
import WorkerACustomersPage from './pages/worker-a/CustomersPage';

// Worker B
import ConfirmSalePage from './pages/worker-b/ConfirmSalePage';
import MyConfirmationsPage from './pages/worker-b/MyConfirmationsPage';

type Role = 'ADMIN' | 'WORKER_A' | 'WORKER_B';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: Role[] }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role as Role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'WORKER_A') return <Navigate to="/worker-a/sales" replace />;
  return <Navigate to="/worker-b/confirm" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="sms-queue" element={<SmsQueuePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
      </Route>

      {/* Worker A Routes */}
      <Route
        path="/worker-a"
        element={
          <ProtectedRoute allowedRoles={['WORKER_A']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="sales" replace />} />
        <Route path="sales" element={<MakeSalePage />} />
        <Route path="my-sales" element={<MySalesPage />} />
        <Route path="products" element={<WorkerAProductsPage />} />
        <Route path="customers" element={<WorkerACustomersPage />} />
      </Route>

      {/* Worker B Routes */}
      <Route
        path="/worker-b"
        element={
          <ProtectedRoute allowedRoles={['WORKER_B']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="confirm" replace />} />
        <Route path="confirm" element={<ConfirmSalePage />} />
        <Route path="my-confirmations" element={<MyConfirmationsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
