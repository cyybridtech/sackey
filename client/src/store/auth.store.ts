import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => {
        localStorage.setItem('pos_token', token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
        set({ user: null, token: null });
      },
    }),
    {
      name: 'pos_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);
