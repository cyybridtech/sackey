import { create } from 'zustand';

interface NotificationsState {
  count: number;
  setCount: (n: number) => void;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  count: 0,
  setCount: (n) => set({ count: n }),
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: Math.max(0, state.count - 1) })),
  reset: () => set({ count: 0 }),
}));
