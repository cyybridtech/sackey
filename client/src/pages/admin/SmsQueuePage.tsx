import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Check, X, CheckCheck } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

export default function SmsQueuePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [selected, setSelected] = useState<number[]>([]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sms-queue'],
    queryFn: async () => {
      const res = await api.get('/sms/queue');
      return res.data.data;
    },
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sms/approve/${id}`),
    onSuccess: () => { toast.success('SMS approved and sent'); qc.invalidateQueries({ queryKey: ['sms-queue'] }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sms/reject/${id}`),
    onSuccess: () => { toast.success('SMS rejected'); qc.invalidateQueries({ queryKey: ['sms-queue'] }); },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: () => api.post('/sms/approve-bulk', { ids: selected }),
    onSuccess: () => { toast.success(`${selected.length} SMS approved`); setSelected([]); qc.invalidateQueries({ queryKey: ['sms-queue'] }); },
  });

  const filtered = items.filter((i: any) => i.status === tab);
  const TAB_VARIANT: Record<Tab, string> = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red' };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">SMS Queue</h1>
        <p className="text-slate-500 text-sm">Approve customer notification messages before they are sent</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['PENDING', 'APPROVED', 'REJECTED'] as Tab[]).map((t) => {
          const count = items.filter((i: any) => i.status === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t} {count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${tab === t ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Bulk Actions */}
      {tab === 'PENDING' && selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-700 font-medium">{selected.length} selected</span>
          <button onClick={() => bulkApproveMutation.mutate()} disabled={bulkApproveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
            <CheckCheck className="w-3.5 h-3.5" /> Approve All Selected
          </button>
          <button onClick={() => setSelected([])} className="text-sm text-slate-500 hover:text-slate-800">Clear</button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No {tab.toLowerCase()} messages.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start">
              {tab === 'PENDING' && (
                <input type="checkbox" checked={selected.includes(item.id)}
                  onChange={(e) => setSelected(s => e.target.checked ? [...s, item.id] : s.filter(i => i !== item.id))}
                  className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-slate-800">{item.customer?.name}</p>
                    <p className="text-xs text-slate-400">{item.customer?.phone}</p>
                  </div>
                  <Badge variant={TAB_VARIANT[tab as Tab] as any}>{tab}</Badge>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-700 mb-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1">Message</span>
                  {item.message}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                  {tab === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => approveMutation.mutate(item.id)} disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition">
                        <Check className="w-3 h-3" /> Approve & Send
                      </button>
                      <button onClick={() => rejectMutation.mutate(item.id)} disabled={rejectMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 transition">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
