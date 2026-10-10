import React, { useState } from 'react';
import { Bell, ChevronDown, Menu, LogOut, Smartphone } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useInstallApp } from '../../hooks/useInstallApp';
import InstallAppModal from '../ui/InstallAppModal';
import { useNotificationsStore } from '../../store/notifications.store';
import api from '../../api/axios';
import { formatDateTime } from '../../lib/utils';
import type { Notification } from '../../types';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const routeTitles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/sales': 'Sales',
  '/admin/customers': 'Customers',
  '/admin/products': 'Products',
  '/admin/credits': 'Credits & Debts',
  '/admin/sms-queue': 'SMS Queue',
  '/admin/users': 'Users',
  '/admin/audit-log': 'Audit Log',
  '/worker-a/sales': 'Make a Sale',
  '/worker-a/my-sales': 'My Sales',
  '/worker-a/products': 'Products',
  '/worker-a/customers': 'Customers',
  '/worker-b/confirm': 'Confirm Sale',
  '/worker-b/my-confirmations': 'My Confirmations',
};

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout, isAdmin } = useAuth();
  const { isInstalled, isIOS, hasNativePrompt, promptInstall } = useInstallApp();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const { count, decrement } = useNotificationsStore();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { data: notifications = [], isLoading: loadingNotifications } = useQuery<Notification[]>({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const response = await api.get('/admin/notifications');
      return response.data.data;
    },
    enabled: isAdmin && notificationsOpen,
  });
  const readNotification = useMutation({
    mutationFn: (id: number) => api.patch(`/admin/notifications/${id}/read`),
    onSuccess: () => {
      decrement();
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const pageTitle = routeTitles[location.pathname] || 'POS System';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-sm">
        {/* Mobile Menu Toggle & Page Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">{pageTitle}</h1>
            <p className="text-[11px] sm:text-xs text-gray-400">
              {new Date().toLocaleDateString('en-GH', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Install POS App to Home Screen Button */}
          {!isInstalled && (
            <button
              onClick={() => promptInstall(() => setShowInstallModal(true))}
              title="Install POS App on your phone"
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Smartphone size={15} />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Notification Bell — Admin Only */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                title="Notifications"
              >
                <Bell size={20} />
                {count > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3 font-semibold text-sm text-slate-800">Notifications</div>
                  {loadingNotifications ? (
                    <p className="px-4 py-6 text-sm text-slate-500">Loading notifications…</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500">No notifications yet.</p>
                  ) : notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => {
                        if (!notification.isRead) readNotification.mutate(notification.id);
                        setNotificationsOpen(false);
                        if (notification.relatedEntity === 'Sale' && notification.relatedId) {
                          const deleted = notification.type === 'SALE_DELETED';
                          navigate(`/admin/sales?${deleted ? 'deleted=true&' : ''}saleId=${notification.relatedId}`);
                        }
                      }}
                      className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${notification.isRead ? 'opacity-70' : 'bg-blue-50/50'}`}
                    >
                      <span className="block text-sm font-medium text-slate-800">{notification.message}</span>
                      <span className="mt-1 block text-xs text-slate-400">{formatDateTime(notification.createdAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User Profile Info */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-200">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-800 leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-400 leading-tight">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>

            {/* Prominent Header Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="ml-1 px-2.5 py-1.5 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all flex items-center gap-1.5 font-semibold text-xs border border-red-200 bg-red-50/80 shadow-xs"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Install App Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        isIOS={isIOS}
        hasNativePrompt={hasNativePrompt}
        onNativeInstall={() => promptInstall()}
      />
    </>
  );
}
