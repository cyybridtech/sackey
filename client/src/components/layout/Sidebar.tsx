import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  CreditCard,
  MessageSquare,
  UserCog,
  ClipboardList,
  LogOut,
  ListOrdered,
  Store,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const adminNavItems: NavItem[] = [
  { to: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/admin/sales', icon: <ShoppingCart size={18} />, label: 'Sales' },
  { to: '/admin/customers', icon: <Users size={18} />, label: 'Customers' },
  { to: '/admin/products', icon: <Package size={18} />, label: 'Products' },
  { to: '/admin/credits', icon: <CreditCard size={18} />, label: 'Credits & Debts' },
  { to: '/admin/sms-queue', icon: <MessageSquare size={18} />, label: 'SMS Queue' },
  { to: '/admin/users', icon: <UserCog size={18} />, label: 'Users' },
  { to: '/admin/audit-log', icon: <ClipboardList size={18} />, label: 'Audit Log' },
];

const workerANavItems: NavItem[] = [
  { to: '/worker-a/sales', icon: <ShoppingCart size={18} />, label: 'New Sale' },
  { to: '/worker-a/my-sales', icon: <ListOrdered size={18} />, label: 'Sales History' },
  { to: '/worker-a/products', icon: <Package size={18} />, label: 'Products' },
  { to: '/worker-a/customers', icon: <Users size={18} />, label: 'Customers' },
];

const workerBNavItems: NavItem[] = [
  { to: '/worker-b/confirm', icon: <Package size={18} />, label: 'Dispatch Goods' },
  { to: '/worker-b/my-confirmations', icon: <ListOrdered size={18} />, label: 'Dispatch History' },
];

const roleLabels: Record<string, string> = {
  ADMIN: 'Store Owner',
  WORKER_A: 'Sales Desk',
  WORKER_B: 'Dispatch',
};

export function Sidebar() {
  const { user, logout, isAdmin, isWorkerA } = useAuth();
  const navigate = useNavigate();

  const navItems = isAdmin ? adminNavItems : isWorkerA ? workerANavItems : workerBNavItems;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-gray-900 flex flex-col z-20 overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
            <Store size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">POS System</h1>
            <p className="text-gray-400 text-xs">Clothing & Underwear</p>
          </div>
        </div>
      </div>

      {/* Role label */}
      <div className="px-5 pt-4 pb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {isAdmin ? 'Admin Portal' : isWorkerA ? 'Sales Desk' : 'Dispatch'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'sidebar-link',
                    isActive ? 'sidebar-link-active' : 'sidebar-link-inactive',
                  )
                }
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Info + Logout */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-gray-400 text-xs truncate">
              {user?.role ? roleLabels[user.role] : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link sidebar-link-inactive w-full text-red-400 hover:bg-red-900/30 hover:text-red-300"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
