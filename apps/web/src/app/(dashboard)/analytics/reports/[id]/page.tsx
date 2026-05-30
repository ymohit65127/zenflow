'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';

function SimpleBarChart({ data, xKey, yKey }: { data: Record<string, unknown>[]; xKey: string; yKey: string }) {
  if (!data.length) return null;
  const values = data.map((row) => Number(row[yKey] ?? 0));
  const maxVal = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-1 h-48 px-2">
      {data.slice(0, 20).map((row, i) => {
        const val = Number(row[yKey] ?? 0);
        const heightPct = (val / maxVal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full">
              <div
                className="bg-indigo-500 rounded-t hover:bg-indigo-400 transition-colors w-full"
                style={{ height: `${Math.max(heightPct * 1.8, 2)}px` }}
                title={`${String(row[xKey] ?? '')}: ${val}`}
              />
            </div>
            <span className="text-xs text-gray-400 truncate w-full text-center" style={{ fontSize: '10px' }}>
              {String(row[xKey] ?? '').slice(0, 8)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: report, isLoading } = api.analytics.reportsV2.get.useQuery({ id });
  const runQuery = api.analytics.reportsV2.run.useQuery({ id }, { enabled: !!report });

  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');

  const vizConfig = report?.visualization_config as Record<string, unknown> | undefined;
  const xAxis = (vizConfig?.x_axis as string) ?? '';
  const yAxis = (vizConfig?.y_axis as string) ?? '';
  const rows = (runQuery.data?.rows as Record<string, unknown>[]) ?? [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse mb-4" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!report) {
    return <div className="p-6 text-center text-gray-500">Report not found.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/analytics/reports" className="text-sm text-gray-500 hover:text-gray-700">Reports</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-900 font-medium">{report.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{report.name}</h1>
          {report.description && <p className="text-sm text-gray-500 mt-1">{report.description}</p>}
        </div>
        <div className="flex gap-2">
          <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-medium">
            {report.report_type}
          </span>
          {report.is_public && (
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Public</span>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Row Count</p>
          <p className="text-2xl font-bold text-gray-900">
            {runQuery.isLoading ? '...' : (runQuery.data?.meta.row_count ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Query Time</p>
          <p className="text-2xl font-bold text-gray-900">
            {runQuery.isLoading ? '...' : `${runQuery.data?.meta.duration_ms ?? 0}ms`}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Last Run</p>
          <p className="text-sm font-semibold text-gray-900">
            {report.last_run_at ? new Date(report.last_run_at).toLocaleDateString() : 'Just now'}
          </p>
        </div>
      </div>

      {/* Chart / Table tabs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chart' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'table' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Data Table
          </button>
        </div>

        <div className="p-6">
          {runQuery.isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-1">No data returned</p>
              <p className="text-sm">Try adjusting the date range or filters</p>
            </div>
          ) : activeTab === 'chart' ? (
            <div>
              {xAxis && yAxis ? (
                <SimpleBarChart data={rows} xKey={xAxis} yKey={yAxis} />
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Configure X and Y axis in the report settings to see a chart.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {rows[0] && Object.keys(rows[0]).map((col) => (
                      <th key={col} className="px-4 py-3 text-left font-medium text-gray-600">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-4 py-3 text-gray-700">{String(val ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled reports */}
      {(report as { scheduled_reports?: unknown[] }).scheduled_reports?.length ? (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Scheduled Deliveries</h3>
          <div className="space-y-2">
            {(report as { scheduled_reports: { id: string; name: string; frequency: string; next_send_at: Date | null }[] }).scheduled_reports.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{s.name}</span>
                <div className="flex items-center gap-3">
                  <span className="capitalize text-gray-500">{s.frequency}</span>
                  {s.next_send_at && (
                    <span className="text-gray-400">Next: {new Date(s.next_send_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
