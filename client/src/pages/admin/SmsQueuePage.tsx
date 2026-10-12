import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Check, X, CheckCheck, Send, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import DeleteConfirmModal from '../../components/ui/DeleteConfirmModal';
import toast from 'react-hot-toast';

type Tab = 'PENDING' | 'SENT' | 'REJECTED' | 'ALL';

export default function SmsQueuePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [selected, setSelected] = useState<number[]>([]);

  // Test SMS Modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello! This is a test message from B.A. Ent.');

  // Edit SMS state
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editedMessage, setEditedMessage] = useState('');

  // Delete SMS state
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'SMS approved and sent successfully!');
      qc.invalidateQueries({ queryKey: ['sms-queue'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to send SMS');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sms/reject/${id}`),
    onSuccess: () => {
      toast.success('SMS marked as rejected');
      qc.invalidateQueries({ queryKey: ['sms-queue'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sms/reverse/${id}`),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'SMS reversed to Pending queue');
      qc.invalidateQueries({ queryKey: ['sms-queue'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to reverse SMS'),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; message: string }) => api.put(`/sms/${input.id}`, { message: input.message }),
    onSuccess: () => {
      toast.success('SMS message updated');
      setEditingItem(null);
      qc.invalidateQueries({ queryKey: ['sms-queue'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update SMS'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sms/${id}`),
    onSuccess: () => {
      toast.success('SMS message deleted from queue');
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ['sms-queue'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete SMS'),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: () => api.post('/sms/approve-bulk', { ids: selected }),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || `${selected.length} SMS processed`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['sms-queue'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to bulk-approve SMS');
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: () => api.post('/sms/test', { phone: testPhone, message: testMessage }),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Test SMS dispatched successfully!');
      setShowTestModal(false);
      setTestPhone('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to dispatch test SMS');
    },
  });

  const filtered = items.filter((i: any) => {
    if (tab === 'ALL') return true;
    if (tab === 'SENT') return i.status === 'SENT' || i.status === 'APPROVED';
    return i.status === tab;
  });

  const TAB_VARIANT: Record<string, string> = {
    PENDING: 'yellow',
    SENT: 'green',
    APPROVED: 'green',
    REJECTED: 'red',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">SMS Notifications Queue</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
              Sender ID: B.A. Ent
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            Review and approve customer SMS notifications before dispatching
          </p>
        </div>

        <button
          onClick={() => setShowTestModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition self-start sm:self-auto"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Test SMS</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['PENDING', 'SENT', 'REJECTED', 'ALL'] as Tab[]).map((t) => {
          const count = items.filter((i: any) => {
            if (t === 'ALL') return true;
            if (t === 'SENT') return i.status === 'SENT' || i.status === 'APPROVED';
            return i.status === t;
          }).length;

          const label =
            t === 'PENDING'
              ? 'Pending Approval'
              : t === 'SENT'
              ? 'Sent'
              : t === 'REJECTED'
              ? 'Rejected'
              : 'All Messages';

          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                    tab === t ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bulk Actions */}
      {tab === 'PENDING' && selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm text-blue-700 font-semibold">{selected.length} selected</span>
          <button
            onClick={() => bulkApproveMutation.mutate()}
            disabled={bulkApproveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Approve & Send Selected</span>
          </button>
          <button
            onClick={() => setSelected([])}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Clear
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No {tab.toLowerCase()} messages found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start shadow-xs hover:border-slate-300 transition"
            >
              {tab === 'PENDING' && (
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, item.id] : s.filter((i) => i !== item.id)
                    )
                  }
                  className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {item.customer?.name || 'Walk-in Customer'}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      {item.customer?.phone || 'No phone number'}
                    </p>
                  </div>
                  <Badge variant={TAB_VARIANT[item.status] as any}>
                    {item.status}
                  </Badge>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs sm:text-sm text-slate-800 mb-3 leading-relaxed whitespace-pre-line font-mono">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">
                    Receipt Message Preview
                  </span>
                  {item.message}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400 space-x-2">
                    <span>Queued: {formatDateTime(item.createdAt)}</span>
                    {item.sentAt && (
                      <span className="text-emerald-600 font-medium">
                        • Dispatched: {formatDateTime(item.sentAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(item.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Send</span>
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(item.id)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {item.status === 'REJECTED' && (
                      <button
                        onClick={() => reverseMutation.mutate(item.id)}
                        disabled={reverseMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reverse to Pending</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setEditedMessage(item.message);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit SMS Modal */}
      {editingItem && (
        <Modal
          title="Edit SMS Message"
          onClose={() => setEditingItem(null)}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Recipient: <strong className="text-slate-800">{editingItem.customer?.name}</strong> ({editingItem.customer?.phone || 'No phone'})
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Message Content
              </label>
              <textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                rows={5}
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending || !editedMessage.trim()}
                onClick={() => updateMutation.mutate({ id: editingItem.id, message: editedMessage })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete SMS Confirmation */}
      <DeleteConfirmModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId !== null) deleteMutation.mutate(deletingId);
        }}
        title="Delete SMS from Queue"
        message="Are you sure you want to permanently delete this SMS notification from the queue?"
        loading={deleteMutation.isPending}
      />

      {/* Send Test SMS Modal */}
      {showTestModal && (
        <Modal
          title="Send Test SMS"
          onClose={() => setShowTestModal(false)}
          size="sm"
        >
          <div className="space-y-4 text-slate-700">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
              Verify message delivery with Sender ID <strong>B.A. Ent</strong> by sending a test SMS to a phone number.
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Recipient Phone Number
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="e.g. 0244123456 or 233244123456"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Message Content
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={testSmsMutation.isPending || !testPhone.trim()}
                onClick={() => testSmsMutation.mutate()}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testSmsMutation.isPending ? 'Sending...' : 'Send Test SMS'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
