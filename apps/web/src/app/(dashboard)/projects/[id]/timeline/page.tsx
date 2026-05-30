'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PHASE_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
};

const MILESTONE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  achieved: 'bg-green-500/10 text-green-600',
  missed: 'bg-red-500/10 text-red-600',
};

export default function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: phases, isLoading: phasesLoading } = api.projects.phases.list.useQuery({ projectId: id });
  const { data: milestones, isLoading: msLoading } = api.projects.milestones.list.useQuery({ projectId: id });
  const { data: project, isLoading: projLoading } = api.projects.get.useQuery({ id });

  const isLoading = phasesLoading || msLoading || projLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build combined timeline events, sorted by date
  const events: Array<{
    type: 'phase_start' | 'phase_end' | 'milestone';
    date: Date;
    id: string;
    name: string;
    color: string;
    status: string;
    description?: string | null;
  }> = [];

  phases?.forEach((phase) => {
    const phaseColor = phase.color ?? '#6B7280';
    if (phase.start_date) {
      events.push({
        type: 'phase_start',
        date: new Date(phase.start_date),
        id: phase.id,
        name: `${phase.name} — Start`,
        color: phaseColor,
        status: phase.status,
        description: phase.description ?? null,
      });
    }
    if (phase.end_date) {
      events.push({
        type: 'phase_end',
        date: new Date(phase.end_date),
        id: phase.id + '_end',
        name: `${phase.name} — End`,
        color: phaseColor,
        status: phase.status,
      });
    }
  });

  milestones?.forEach((m) => {
    events.push({
      type: 'milestone',
      date: new Date(m.due_date),
      id: m.id,
      name: m.name,
      color: '#F59E0B',
      status: m.status,
      description: m.description ?? null,
    });
  });

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/projects/${id}`)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{project?.name ?? 'Project'} — Timeline</h1>
          <p className="text-sm text-muted-foreground">
            {phases?.length ?? 0} phases · {milestones?.length ?? 0} milestones
          </p>
        </div>
      </div>

      {/* Phases summary */}
      {phases && phases.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Phases</h2>
          <div className="space-y-2">
            {phases.map((phase) => {
              const hasStart = !!phase.start_date;
              const hasEnd = !!phase.end_date;
              const startDate = hasStart ? new Date(phase.start_date!) : null;
              const endDate = hasEnd ? new Date(phase.end_date!) : null;
              const totalDays =
                startDate && endDate
                  ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
              const elapsed =
                startDate && startDate <= today
                  ? Math.min(
                      Math.round((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
                      totalDays ?? 0
                    )
                  : 0;
              const progress = totalDays && totalDays > 0 ? Math.round((elapsed / totalDays) * 100) : 0;

              return (
                <div
                  key={phase.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
                >
                  <div
                    className="w-3 h-12 rounded-full flex-shrink-0"
                    style={{ backgroundColor: phase.color ?? '#6B7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{phase.name}</span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          PHASE_STATUS_COLORS[phase.status] ?? 'bg-muted text-muted-foreground'
                        )}
                      >
                        {phase.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {startDate && <span>Start: {formatDate(startDate)}</span>}
                      {endDate && <span>End: {formatDate(endDate)}</span>}
                      {totalDays !== null && <span>{totalDays} days</span>}
                    </div>
                    {totalDays !== null && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${progress}%`, backgroundColor: phase.color ?? '#6B7280' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold">—</div>
                    <div className="text-xs text-muted-foreground">tasks</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Timeline view */}
      {events.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-3">Events</h2>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[calc(6rem+0.5rem)] top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-0">
              {events.map((event, i) => {
                const isPast = event.date < today;
                const isToday =
                  event.date.toDateString() === today.toDateString();

                return (
                  <div key={event.id + i} className="relative flex items-start gap-4 pb-6">
                    {/* Date label */}
                    <div className="w-24 text-right flex-shrink-0 pt-1">
                      <span className={cn('text-xs', isPast ? 'text-muted-foreground' : 'font-medium')}>
                        {event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {isToday && (
                        <div className="text-[9px] text-brand-500 font-medium">Today</div>
                      )}
                    </div>

                    {/* Dot */}
                    <div
                      className={cn(
                        'relative z-10 w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ring-2 ring-background',
                        event.type === 'milestone' ? 'w-4 h-4 rotate-45 rounded-sm' : 'rounded-full'
                      )}
                      style={{ backgroundColor: event.color }}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium', isPast && 'text-muted-foreground')}>
                          {event.name}
                        </span>
                        {event.type === 'milestone' && (
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded-full',
                              MILESTONE_STATUS_COLORS[event.status] ?? 'bg-muted text-muted-foreground'
                            )}
                          >
                            {event.status}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
          <Clock className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No timeline events yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add phases with dates or milestones to see the timeline
          </p>
        </div>
      )}
    </div>
  );
}
