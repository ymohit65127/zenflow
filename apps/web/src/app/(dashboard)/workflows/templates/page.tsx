'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM',
  hr: 'HR',
  notifications: 'Notifications',
  helpdesk: 'Help Desk',
  projects: 'Projects',
  accounting: 'Accounting',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

export default function WorkflowTemplatesPage() {
  const router = useRouter();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | undefined>(undefined);
  const [search, setSearch] = useState('');

  const { data: templates, isLoading } = api.workflows.templates.list.useQuery({
    category,
    difficulty,
    search: search || undefined,
  });

  const installMutation = api.workflows.templates.install.useMutation({
    onSuccess: (workflow) => {
      router.push(`/workflows/${workflow.id}`);
    },
  });

  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installName, setInstallName] = useState('');
  const [showInstallModal, setShowInstallModal] = useState<string | null>(null);

  async function handleInstall(templateId: string) {
    if (!installName.trim()) return;
    setInstallingId(templateId);
    await installMutation.mutateAsync({ templateId, name: installName.trim() });
    setInstallingId(null);
    setShowInstallModal(null);
    setInstallName('');
  }

  const categories = [...new Set(templates?.map((t) => t.category) ?? [])];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workflow Templates</h1>
        <p className="text-sm text-gray-500 mt-1">Start from a pre-built automation template</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? undefined : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(difficulty === d ? undefined : d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                difficulty === d
                  ? DIFFICULTY_COLORS[d]
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates?.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">ðŸ“¦</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No templates found</h3>
          <p className="text-gray-500 text-sm">Try different filters or create a workflow from scratch.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((template) => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${DIFFICULTY_COLORS[template.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                    {template.difficulty}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                    {CATEGORY_LABELS[template.category] ?? template.category}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{template.install_count} installs</span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
              )}

              {template.required_integrations.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.required_integrations.map((int) => (
                    <span key={int} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {int}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setShowInstallModal(template.id);
                  setInstallName(template.name);
                }}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors mt-2"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Install modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-semibold text-lg text-gray-900 mb-4">Install Template</h2>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Workflow Name</label>
              <input
                value={installName}
                onChange={(e) => setInstallName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowInstallModal(null); setInstallName(''); }}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleInstall(showInstallModal)}
                disabled={!installName.trim() || installingId === showInstallModal}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {installingId === showInstallModal ? 'Installing...' : 'Install & Edit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

