import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';

interface AppLayoutProps {
  requiredRole?: 'ADMIN' | 'WORKER_A' | 'WORKER_B';
}

export function AppLayout({ requiredRole }: AppLayoutProps) {
  const { isAuthenticated, user } = useAuth();

  // Initialize socket connection
  useSocket();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to appropriate home based on role
    const roleHome: Record<string, string> = {
      ADMIN: '/admin/dashboard',
      WORKER_A: '/worker-a/sales',
      WORKER_B: '/worker-b/confirm',
    };
    return <Navigate to={roleHome[user?.role || ''] || '/login'} replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-[260px] overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
