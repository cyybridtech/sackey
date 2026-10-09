import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Shield, ToggleLeft, ToggleRight, Pencil, KeyRound } from 'lucide-react';
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
      toast.success('User created successfully. Worker will set up credentials on first login.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add New Worker / User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
          <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            Give the worker this initial Username & Password. Upon logging in, they will be automatically directed to set up their own private username and password.
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
          <input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Worker's Full Name"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Initial Username *</label>
          <input required value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
            placeholder="e.g. worker_sales1"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Initial Password *</label>
          <input required type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Temporary password"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Role *</label>
          <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="WORKER_A">Sales Desk (Worker A)</option>
            <option value="WORKER_B">Dispatch (Worker B)</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            {loading ? 'Creating...' : 'Create Worker Account'}
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
    <Modal title="Edit User Details" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
          <input required value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Username *</label>
          <input required value={form.username} onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ROLE_VARIANT: Record<string, any> = { ADMIN: 'blue', WORKER_A: 'green', WORKER_B: 'orange' };
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  WORKER_A: 'Sales Desk',
  WORKER_B: 'Dispatch',
};

export default function UsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

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
    onSuccess: () => { toast.success('User status updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update user status'),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Worker & User Management</h1>
          <p className="text-slate-500 text-sm">Create workers, manage roles, and control active status</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm">
          <UserPlus className="w-4 h-4" /> Add Worker / User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Username', 'Role', 'Account Status', 'Setup Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u: any) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800 block">{u.name}</span>
                          {isSelf && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-semibold">You</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.mustChangePassword ? (
                        <Badge variant="yellow">Pending First Login</Badge>
                      ) : (
                        <Badge variant="blue">Completed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button title="Edit user" onClick={() => setEditUser(u)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {isSelf ? (
                          <span className="text-xs text-slate-400 italic">Self (Active)</span>
                        ) : (
                          <button onClick={() => toggleMutation.mutate({ id: u.id, isActive: u.isActive })}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition">
                            {u.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
    </div>
  );
}
