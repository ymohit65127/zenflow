'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  timed_out: 'bg-gray-100 text-gray-600',
};

export default function WorkflowApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'timed_out' | undefined>(undefined);
  const [tab, setTab] = useState<'my' | 'all'>('my');

  const myPending = api.workflows.approvals.myPending.useQuery();
  const allApprovals = api.workflows.approvals.list.useQuery({ status: statusFilter });

  const approveMutation = api.workflows.approvals.approve.useMutation({
    onSuccess: () => {
      void myPending.refetch();
      void allApprovals.refetch();
    },
  });

  const rejectMutation = api.workflows.approvals.reject.useMutation({
    onSuccess: () => {
      void myPending.refetch();
      void allApprovals.refetch();
    },
  });

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  async function handleApprove(requestId: string) {
    await approveMutation.mutateAsync({ requestId, remarks });
    setApprovingId(null);
    setRemarks('');
  }

  async function handleReject(requestId: string) {
    if (!rejectReason.trim()) return;
    await rejectMutation.mutateAsync({ requestId, reason: rejectReason });
    setRejectingId(null);
    setRejectReason('');
  }

  const myItems = myPending.data ?? [];
  const allItems = allApprovals.data?.items ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">Review and respond to pending approval requests</p>
        </div>
        {myItems.length > 0 && (
          <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">
            {myItems.length} pending
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('my')}
          className={`px-5 py-3 text-sm font-medium transition-colors ${
            tab === 'my' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Pending ({myItems.length})
        </button>
        <button
          onClick={() => setTab('all')}
          className={`px-5 py-3 text-sm font-medium transition-colors ${
            tab === 'all' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All Approvals
        </button>
      </div>

      {tab === 'all' && (
        <div className="flex gap-2 mb-4">
          {(['pending', 'approved', 'rejected', 'timed_out'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? undefined : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                statusFilter === s ? STATUS_COLORS[s] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {tab === 'my' ? (
        myItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">âœ…</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No pending approvals</h3>
            <p className="text-gray-500 text-sm">You have no pending approval requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myItems.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{item.run.workflow.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Requested {new Date(item.created_at).toLocaleString()}
                      {item.expires_at && (
                        <span className="text-orange-600 ml-2">
                          Expires {new Date(item.expires_at).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
                    {item.status}
                  </span>
                </div>

                {item.message && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700">
                    {item.message}
                  </div>
                )}

                {item.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setApprovingId(item.id)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(item.id)}
                      className="flex-1 bg-red-50 text-red-700 border border-red-200 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        allItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No approvals found.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Workflow</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Message</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Requested</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.run.workflow.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{item.message ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[item.status]}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.approved_at ? new Date(item.approved_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Approve modal */}
      {approvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-semibold text-lg text-gray-900 mb-4">Approve Request</h2>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Remarks (optional)</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Add any notes..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setApprovingId(null); setRemarks(''); }} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => handleApprove(approvingId)}
                disabled={approveMutation.isPending}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {approveMutation.isPending ? 'Approving...' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-semibold text-lg text-gray-900 mb-4">Reject Request</h2>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Reason *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Explain why you are rejecting..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => handleReject(rejectingId)}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

