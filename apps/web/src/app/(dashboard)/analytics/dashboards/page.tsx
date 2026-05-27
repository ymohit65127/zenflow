'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';

export default function DashboardsPage() {
  const [scope, setScope] = useState<'personal' | 'team' | 'org' | undefined>(undefined);
  const { data, isLoading, refetch } = api.analytics.dashboards.list.useQuery({ scope });
  const createMutation = api.analytics.dashboards.create.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = api.analytics.dashboards.delete.useMutation({ onSuccess: () => refetch() });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'personal' | 'team' | 'org'>('personal');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createMutation.mutateAsync({ name: newName.trim(), scope: newScope });
    setNewName('');
    setShowCreate(false);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboards</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage your analytics dashboards</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          New Dashboard
        </button>
      </div>

      {/* Scope filter */}
      <div className="flex gap-2 mb-6">
        {(['personal', 'team', 'org'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(scope === s ? undefined : s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              scope === s
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">New Dashboard</h3>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Dashboard name..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              autoFocus
            />
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as 'personal' | 'team' | 'org')}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="personal">Personal</option>
              <option value="team">Team</option>
              <option value="org">Organization</option>
            </select>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">ðŸ“Š</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No dashboards yet</h3>
          <p className="text-gray-500 text-sm">Create your first dashboard to start visualizing data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((dashboard) => (
            <div key={dashboard.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {dashboard.is_default && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Default</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      dashboard.scope === 'personal' ? 'bg-blue-100 text-blue-700' :
                      dashboard.scope === 'team' ? 'bg-green-100 text-green-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {dashboard.scope}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{dashboard.name}</h3>
                  {dashboard.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{dashboard.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {(dashboard as { _count?: { items: number } })._count?.items ?? 0} widgets
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Link
                  href={`/analytics/dashboards/${dashboard.id}`}
                  className="flex-1 text-center bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  Open
                </Link>
                <button
                  onClick={() => deleteMutation.mutate({ id: dashboard.id })}
                  disabled={deleteMutation.isPending}
                  className="text-red-400 hover:text-red-600 px-3 py-1.5 text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

