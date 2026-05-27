// @ts-nocheck
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '@/trpc/react';
import { GanttChart } from '@/components/projects/GanttChart';
import { cn } from '@/lib/utils';

export default function GanttPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data, isLoading, error } = api.projects.gantt.getGanttData.useQuery({
    projectId: id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-muted-foreground">Failed to load Gantt data</p>
      </div>
    );
  }

  const projectStart = data.project.startDate
    ? new Date(data.project.startDate)
    : new Date();
  const projectEnd = data.project.endDate
    ? new Date(data.project.endDate)
    : (() => {
        const d = new Date(projectStart);
        d.setMonth(d.getMonth() + 3);
        return d;
      })();

  const tasksWithDates = data.tasks.map((t) => ({
    ...t,
    start_date: t.start_date ? new Date(t.start_date) : null,
    due_date: t.due_date ? new Date(t.due_date) : null,
    status: t.status as { name: string; color: string; status_type: string } | null,
    assignees: (t.assignees ?? []).map((a) => ({
      user: {
        name: (a.user as { name: string }).name,
        avatar_url: (a.user as { avatar_url: string | null }).avatar_url ?? null,
      },
    })),
    dependencies: (t.dependencies ?? []).map((d) => ({
      depends_on_task_id: d.depends_on_task_id,
      dependency_type: d.dependency_type,
    })),
  }));

  const phasesWithDates = data.phases.map((p) => ({
    ...p,
    start_date: p.start_date ? new Date(p.start_date) : null,
    end_date: p.end_date ? new Date(p.end_date) : null,
  }));

  const milestonesWithDates = data.milestones.map((m) => ({
    ...m,
    due_date: new Date(m.due_date),
  }));

  const criticalCount = data.tasks.filter((t) => t.isCritical).length;
  const blockedCount = data.tasks.filter((t) => t.is_blocked).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/projects/${id}`)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{data.project.name} — Gantt</h1>
            <p className="text-sm text-muted-foreground">
              {data.tasks.length} tasks · {data.phases.length} phases · {data.milestones.length} milestones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-red-500/10 text-red-500 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              {criticalCount} critical path
            </div>
          )}
          {blockedCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-600 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              {blockedCount} blocked
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Tasks', value: data.tasks.length, color: 'text-foreground' },
          { label: 'Critical Path', value: criticalCount, color: 'text-red-500' },
          { label: 'Blocked', value: blockedCount, color: 'text-amber-500' },
          {
            label: 'Milestones',
            value: data.milestones.length,
            color: 'text-amber-400',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Gantt Chart */}
      {data.tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground">No tasks with dates to display in Gantt view.</p>
          <p className="text-sm text-muted-foreground mt-1">Add start and due dates to tasks to see them here.</p>
        </div>
      ) : (
        <GanttChart
          tasks={tasksWithDates}
          phases={phasesWithDates}
          milestones={milestonesWithDates}
          projectStart={projectStart}
          projectEnd={projectEnd}
          onTaskClick={setSelectedTaskId}
        />
      )}

      {/* Selected task info */}
      {selectedTaskId && (
        <div className="bg-card border border-border rounded-xl p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">
              {data.tasks.find((t) => t.id === selectedTaskId)?.title}
            </p>
            <button
              onClick={() => setSelectedTaskId(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          {(() => {
            const t = data.tasks.find((t) => t.id === selectedTaskId);
            if (!t) return null;
            return (
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                {t.float !== null && (
                  <span>Float: <span className="text-foreground font-medium">{t.float} days</span></span>
                )}
                {t.isCritical && (
                  <span className="text-red-500 font-medium">On Critical Path</span>
                )}
                {t.is_blocked && (
                  <span className="text-amber-500 font-medium">Blocked</span>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
