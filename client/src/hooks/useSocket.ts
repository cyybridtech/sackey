import { useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useNotificationsStore } from '../store/notifications.store';

export function useSocket() {
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();
  const { increment } = useNotificationsStore();
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection failed:', error.message);
    });

    socket.on('notification:new', (data: { title: string; message: string }) => {
      increment();
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast(data.message || data.title, {
        icon: '🔔',
        duration: 5000,
      });
    });

    socket.on('sale:updated', () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    });

    socket.on('sale:status-changed', () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['my-sales'] });
      void queryClient.invalidateQueries({ queryKey: ['my-confirmations'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, token, increment, queryClient]);
}
