import { useAuthStore } from '../store/auth.store';

export function useAuth() {
  const { user, token, login, logout } = useAuthStore();

  return {
    user,
    token,
    login,
    logout,
    isAdmin: user?.role === 'ADMIN',
    isWorkerA: user?.role === 'WORKER_A',
    isWorkerB: user?.role === 'WORKER_B',
    isAuthenticated: !!user && !!token,
  };
}
