'use client';

import { use, useState, useRef, useCallback } from 'react';
import { api } from '@/trpc/react';
import { TRPCError } from '@trpc/server';

// CSS Grid-based drag-drop widget grid (no external library)

type GridItem = {
  id: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  title_override: string | null;
  report: {
    id: string;
    name: string;
    report_type: string;
    visualization_config: unknown;
    last_run_at: Date | null;
  } | null;
};

type DragState = {
  itemId: string;
  startX: number;
  startY: number;
  origGridX: number;
  origGridY: number;
};

const CELL_SIZE = 80; // px per grid cell
const COLS = 12;

function WidgetCard({ item, onRemove }: { item: GridItem; onRemove: () => void }) {
  const runQuery = api.analytics.reportsV2.run.useQuery(
    { id: item.report?.id ?? '' },
    { enabled: !!item.report?.id }
  );

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-sm h-full flex flex-col overflow-hidden"
      style={{
        gridColumn: `${item.grid_x + 1} / span ${item.grid_w}`,
        gridRow: `${item.grid_y + 1} / span ${item.grid_h}`,
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h4 className="font-medium text-gray-800 text-sm truncate">
          {item.title_override ?? item.report?.name ?? 'Widget'}
        </h4>
        <div className="flex items-center gap-2">
          {item.report && (
            <span className="text-xs text-gray-400">
              {item.report.report_type}
            </span>
          )}
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
            title="Remove widget"
          >
            &times;
          </button>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        {runQuery.isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        )}
        {runQuery.data && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              {runQuery.data.meta.row_count} rows · {runQuery.data.meta.duration_ms}ms
            </p>
            <div className="overflow-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    {!!runQuery.data.rows[0] && Object.keys(runQuery.data.rows[0] as object).map((col) => (
                      <th key={col} className="px-2 py-1 text-gray-500 font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(runQuery.data.rows as Record<string, unknown>[]).slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-2 py-1 text-gray-700">{String(val ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!item.report && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No report linked
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: dashboard, isLoading, refetch } = api.analytics.dashboards.get.useQuery({ id });
  const removeWidgetMutation = api.analytics.dashboards.removeWidget.useMutation({ onSuccess: () => refetch() });
  const saveLayoutMutation = api.analytics.dashboards.saveLayout.useMutation();

  const [isDirty, setIsDirty] = useState(false);
  const [localItems, setLocalItems] = useState<GridItem[] | null>(null);

  const items = localItems ?? (dashboard?.items as GridItem[] | undefined) ?? [];

  function handleRemove(itemId: string) {
    removeWidgetMutation.mutate({ itemId });
  }

  function handleSaveLayout() {
    saveLayoutMutation.mutate({
      id,
      items: items.map((item) => ({
        id: item.id,
        grid_x: item.grid_x,
        grid_y: item.grid_y,
        grid_w: item.grid_w,
        grid_h: item.grid_h,
      })),
    });
    setIsDirty(false);
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse mb-4" />
        <div className="grid grid-cols-12 gap-3" style={{ minHeight: 400 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="col-span-6 h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <div className="p-6 text-center text-gray-500">Dashboard not found.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
          {dashboard.description && <p className="text-sm text-gray-500 mt-1">{dashboard.description}</p>}
        </div>
        <div className="flex gap-3">
          {isDirty && (
            <button
              onClick={handleSaveLayout}
              disabled={saveLayoutMutation.isPending}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saveLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
            </button>
          )}
          <span className="text-sm text-gray-500 self-center">
            {items.length} widget{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="text-4xl mb-3">📈</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No widgets yet</h3>
          <p className="text-gray-500 text-sm">Add reports as widgets to visualize your data here.</p>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridAutoRows: `${CELL_SIZE}px`,
          }}
        >
          {items.map((item) => (
            <WidgetCard
              key={item.id}
              item={item}
              onRemove={() => handleRemove(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
