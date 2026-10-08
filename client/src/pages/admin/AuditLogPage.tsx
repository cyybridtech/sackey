import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: async () => {
      const res = await api.get('/admin/audit-log', { params: { page, limit } });
      return res.data.data;
    },
  });

  const logs = Array.isArray(data) ? data : (data?.logs || []);
  const total = data?.total || (Array.isArray(data) ? data.length : 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-slate-500 text-sm">Complete record of all system actions</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            No log entries yet.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Time', 'User', 'Action', 'Entity', 'ID', 'IP'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{log.user?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.entityType}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{log.entityId ? `#${log.entityId}` : '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{log.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 p-4 border-t border-slate-200">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">Prev</button>
                <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
