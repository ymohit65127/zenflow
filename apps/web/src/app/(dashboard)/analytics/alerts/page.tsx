'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';

const OPERATOR_LABELS: Record<string, string> = {
  gt: '> Greater than',
  lt: '< Less than',
  gte: '>= At least',
  lte: '<= At most',
  eq: '= Equal to',
  change_pct_up: '% Increased by',
  change_pct_down: '% Decreased by',
};

export default function DataAlertsPage() {
  const { data: alerts, isLoading, refetch } = api.analytics.alerts.list.useQuery({});
  const toggleMutation = api.analytics.alerts.toggle.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = api.analytics.alerts.delete.useMutation({ onSuccess: () => refetch() });

  const [showCreate, setShowCreate] = useState(false);
  const { data: reports } = api.analytics.reportsV2.list.useQuery({ page: 1 });

  const createMutation = api.analytics.alerts.create.useMutation({
    onSuccess: () => { refetch(); setShowCreate(false); resetForm(); },
  });

  const [reportId, setReportId] = useState('');
  const [alertName, setAlertName] = useState('');
  const [metricPath, setMetricPath] = useState('rows[0].count_id');
  const [operator, setOperator] = useState<'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'change_pct_up' | 'change_pct_down'>('gt');
  const [threshold, setThreshold] = useState('');
  const [recipients, setRecipients] = useState('');

  function resetForm() {
    setReportId(''); setAlertName(''); setMetricPath('rows[0].count_id');
    setOperator('gt'); setThreshold(''); setRecipients('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!reportId || !alertName || !threshold || !recipients) return;
    await createMutation.mutateAsync({
      report_id: reportId,
      name: alertName,
      metric_path: metricPath,
      operator,
      threshold: parseFloat(threshold),
      notification_channels: { email: true, sms: false, in_app: true },
      recipients: recipients.split(',').map((r) => r.trim()).filter(Boolean),
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Get notified when metrics cross thresholds</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          New Alert
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">New Data Alert</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Report</label>
                <select
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="">Select report...</option>
                  {reports?.reports.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Alert Name</label>
                <input
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  required
                  placeholder="e.g. High ticket volume"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Metric Path</label>
                <input
                  value={metricPath}
                  onChange={(e) => setMetricPath(e.target.value)}
                  placeholder="rows[0].count_id"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Operator</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as typeof operator)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                    <option key={op} value={op}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Threshold</label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                  placeholder="100"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Recipients (comma-separated emails)</label>
              <input
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                required
                placeholder="team@company.com, manager@company.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alerts?.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">ðŸ””</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No alerts configured</h3>
          <p className="text-gray-500 text-sm">Create an alert to get notified when metrics cross thresholds.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Alert</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Report</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Condition</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Triggered</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts?.map((alert) => (
                <tr key={alert.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{alert.name}</td>
                  <td className="px-4 py-3 text-gray-500">{(alert as { report?: { name: string } }).report?.name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-600">
                      {OPERATOR_LABELS[alert.operator]?.split(' ').slice(1).join(' ')} {Number(alert.threshold).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {alert.last_triggered_at
                      ? new Date(alert.last_triggered_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleMutation.mutate({ id: alert.id, active: !alert.is_active })}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        alert.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {alert.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteMutation.mutate({ id: alert.id })}
                      className="text-red-400 hover:text-red-600 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

