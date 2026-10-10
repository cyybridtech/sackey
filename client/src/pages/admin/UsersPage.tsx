import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Shield,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  KeyRound,
  Users,
  ShoppingCart,
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import api from '../../api/axios';
import { formatDate } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

function AddUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'WORKER_A' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/users', form);
      toast.success('Worker account created. They will set their private username & password on first login.');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create New Worker Account" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
          <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold block">First-Time Login Flow:</span>
            Provide the worker with this initial username and temporary password. Upon their first login, the system will prompt them to choose their own personal username and secret password.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Samuel Sackey"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Initial Username *</label>
          <input
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.trim() }))}
            placeholder="e.g. samuel_sales"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white font-mono text-xs transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Temporary Password *</label>
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="e.g. pass123"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assigned Role & Responsibilities *</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'WORKER_A', label: 'Sales Desk', desc: 'Creates sales & customer orders' },
              { id: 'WORKER_B', label: 'Dispatch', desc: 'Confirms & dispatches goods' },
              { id: 'ADMIN', label: 'Store Owner', desc: 'Full system management' },
            ].map((r) => (
              <label
                key={r.id}
                className={`flex flex-col p-3 rounded-xl border text-xs cursor-pointer transition ${
                  form.role === r.id
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-semibold ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={form.role === r.id}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="sr-only"
                />
                <span className="font-bold text-sm">{r.label}</span>
                <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">{r.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow transition disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create Worker'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: user.name, username: user.username });
  const mutation = useMutation({
    mutationFn: () => api.put(`/admin/users/${user.id}`, form),
    onSuccess: () => {
      toast.success('User updated successfully');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update user'),
  });

  return (
    <Modal title="Edit User Information" onClose={onClose} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username *</label>
          <input
            required
            value={form.username}
            onChange={(e) => setForm((current) => ({ ...current, username: e.target.value.trim() }))}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
          />
        </div>
        <div className="flex gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow transition disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteUserModal({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/users/${user.id}`),
    onSuccess: () => {
      toast.success(`User "${user.name}" has been deleted.`);
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete user'),
  });

  return (
    <Modal title="Confirm User Deletion" onClose={onClose} size="sm">
      <div className="space-y-4 text-slate-700">
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 leading-relaxed">
            <span className="font-bold block text-sm mb-1">Delete "{user.name}" (@{user.username})?</span>
            Are you sure you want to delete this user? They will immediately lose system access. Historical sales records and audit logs created by this user will remain securely archived for accounting integrity.
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

const ROLE_VARIANT: Record<string, any> = { ADMIN: 'blue', WORKER_A: 'green', WORKER_B: 'orange' };
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Store Owner',
  WORKER_A: 'Sales Desk',
  WORKER_B: 'Dispatch',
};

export default function UsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.put(`/admin/users/${id}`, { isActive: !isActive }),
    onSuccess: () => {
      toast.success('User status updated');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update user status'),
  });

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase());
      const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, search, selectedRole]);

  // Summary counts
  const stats = useMemo(() => {
    const total = users.length;
    const salesDesk = users.filter((u: any) => u.role === 'WORKER_A').length;
    const dispatch = users.filter((u: any) => u.role === 'WORKER_B').length;
    const active = users.filter((u: any) => u.isActive).length;
    return { total, salesDesk, dispatch, active };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Worker & User Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Manage staff accounts, assign roles, and control active credentials
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl transition text-sm font-bold shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Worker</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Staff</p>
            <p className="text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sales Desk</p>
            <p className="text-xl font-bold text-slate-900">{stats.salesDesk}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dispatch Team</p>
            <p className="text-xl font-bold text-slate-900">{stats.dispatch}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Status</p>
            <p className="text-xl font-bold text-slate-900">
              {stats.active} <span className="text-xs font-normal text-slate-500">/ {stats.total}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Role Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Users' },
              { id: 'WORKER_A', label: 'Sales Desk' },
              { id: 'WORKER_B', label: 'Dispatch' },
              { id: 'ADMIN', label: 'Store Owner' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedRole(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedRole === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff by name or username..."
              className="w-full pl-9 pr-3.5 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"
            />
          </div>
        </div>
      </div>

      {/* Users Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No users found matching the filter criteria.</p>
          </div>
        ) : (
          <>
            {/* Mobile View: High Polish Cards */}
            <div className="md:hidden p-3 space-y-3 bg-slate-50/50">
              {filteredUsers.map((u: any) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div
                    key={u.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-mono">@{u.username}</span>
                        </div>
                      </div>
                      <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Account Status</span>
                        <span className="inline-flex items-center gap-1.5 font-bold mt-0.5">
                          <span
                            className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          />
                          <span className={u.isActive ? 'text-emerald-700' : 'text-slate-600'}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Credential Setup</span>
                        {u.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-bold mt-0.5">
                            <Lock className="w-3 h-3" /> Pending Login
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-bold mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="text-slate-400 text-[11px]">Joined {formatDate(u.createdAt)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          title="Edit user"
                          onClick={() => setEditUser(u)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium flex items-center gap-1 border border-blue-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="text-xs">Edit</span>
                        </button>

                        {!isSelf && (
                          <>
                            <button
                              onClick={() => toggleMutation.mutate({ id: u.id, isActive: u.isActive })}
                              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                                u.isActive
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              }`}
                            >
                              {u.isActive ? (
                                <ToggleRight className="w-4 h-4 text-amber-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-emerald-600" />
                              )}
                              <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                            </button>

                            <button
                              title="Delete worker"
                              onClick={() => setDeleteTarget(u)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition border border-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Clean Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Staff Member', 'Username', 'Assigned Role', 'Account Status', 'Setup Status', 'Created', 'Actions'].map(
                      (h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u: any) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 block leading-tight">{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold inline-block mt-0.5">
                                  You (Active Store Owner)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">@{u.username}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                            <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                            <span
                              className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                            />
                            <span className={u.isActive ? 'text-emerald-700' : 'text-slate-500'}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.mustChangePassword ? (
                            <Badge variant="yellow">Pending First Login</Badge>
                          ) : (
                            <Badge variant="blue">Setup Completed</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(u.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              title="Edit user"
                              onClick={() => setEditUser(u)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {isSelf ? (
                              <span className="text-xs text-slate-400 italic">Self Account</span>
                            ) : (
                              <>
                                <button
                                  onClick={() => toggleMutation.mutate({ id: u.id, isActive: u.isActive })}
                                  title={u.isActive ? 'Deactivate account' : 'Activate account'}
                                  className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition p-1"
                                >
                                  {u.isActive ? (
                                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5 text-slate-400" />
                                  )}
                                </button>
                                <button
                                  title="Delete user"
                                  onClick={() => setDeleteTarget(u)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      {deleteTarget && <DeleteUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
