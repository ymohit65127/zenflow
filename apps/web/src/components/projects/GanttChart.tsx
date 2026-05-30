'use client';

import { useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface GanttTask {
  id: string;
  title: string;
  start_date: Date | null;
  due_date: Date | null;
  isCritical: boolean;
  is_blocked: boolean;
  dependencies: Array<{ depends_on_task_id: string; dependency_type: string }>;
  status: { name: string; color: string; status_type: string } | null;
  phase_id: string | null;
  assignees?: Array<{ user: { name: string; avatar_url: string | null } }>;
}

interface GanttPhase {
  id: string;
  name: string;
  color: string;
  start_date: Date | null;
  end_date: Date | null;
}

interface GanttMilestone {
  id: string;
  name: string;
  due_date: Date;
  color: string;
  status: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  phases?: GanttPhase[];
  milestones?: GanttMilestone[];
  projectStart: Date;
  projectEnd: Date;
  onTaskClick?: (taskId: string) => void;
}

const DAY_WIDTH = 32; // px per day
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 56;
const LABEL_WIDTH = 240;

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function GanttChart({
  tasks,
  phases = [],
  milestones = [],
  projectStart,
  projectEnd,
  onTaskClick,
}: GanttChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const totalDays = Math.max(daysBetween(projectStart, projectEnd) + 1, 30);
  const chartWidth = totalDays * DAY_WIDTH;
  const today = new Date();
  const todayOffset = daysBetween(projectStart, today);

  // Build week header ticks
  const weeks = useMemo(() => {
    const result: Array<{ label: string; offset: number }> = [];
    const d = new Date(projectStart);
    // Align to Monday
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    while (d <= projectEnd) {
      result.push({ label: formatDate(d), offset: daysBetween(projectStart, d) });
      d.setDate(d.getDate() + 7);
    }
    return result;
  }, [projectStart, projectEnd]);

  // Build task rows
  const taskRows = useMemo(() => {
    return tasks.map((task, rowIndex) => {
      const start = task.start_date ?? projectStart;
      const end = task.due_date ?? addDays(start, 1);
      const x = daysBetween(projectStart, start) * DAY_WIDTH;
      const width = Math.max(daysBetween(start, end) * DAY_WIDTH, DAY_WIDTH);
      const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
      return { task, x, width, y, rowIndex };
    });
  }, [tasks, projectStart]);

  // Build dependency arrows (simplified: draw lines between task bars)
  const arrows = useMemo(() => {
    const rowMap = new Map(taskRows.map((r) => [r.task.id, r]));
    const result: Array<{ x1: number; y1: number; x2: number; y2: number; id: string }> = [];

    for (const row of taskRows) {
      for (const dep of row.task.dependencies) {
        const fromRow = rowMap.get(dep.depends_on_task_id);
        if (!fromRow) continue;
        const x1 = fromRow.x + fromRow.width;
        const y1 = fromRow.y + ROW_HEIGHT / 2;
        const x2 = row.x;
        const y2 = row.y + ROW_HEIGHT / 2;
        result.push({ x1, y1, x2, y2, id: `${fromRow.task.id}-${row.task.id}` });
      }
    }
    return result;
  }, [taskRows]);

  const svgHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT + 20;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex">
        {/* Left label column */}
        <div
          className="flex-shrink-0 border-r border-border bg-card z-10"
          style={{ width: LABEL_WIDTH }}
        >
          {/* Header */}
          <div
            className="flex items-end px-3 pb-2 border-b border-border text-xs font-medium text-muted-foreground"
            style={{ height: HEADER_HEIGHT }}
          >
            Task
          </div>
          {taskRows.map(({ task, rowIndex }) => (
            <div
              key={task.id}
              className={cn(
                'flex items-center gap-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors truncate',
                rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'
              )}
              style={{ height: ROW_HEIGHT }}
              onClick={() => onTaskClick?.(task.id)}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: task.status?.color ?? '#6B7280' }}
              />
              <span className="text-xs truncate">{task.title}</span>
              {task.isCritical && (
                <span className="ml-auto text-[9px] bg-red-500/10 text-red-500 rounded px-1 flex-shrink-0">
                  CP
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Gantt chart area */}
        <div className="overflow-x-auto flex-1">
          <svg
            ref={svgRef}
            width={chartWidth}
            height={svgHeight}
            className="block"
          >
            {/* Background stripes */}
            {taskRows.map(({ rowIndex }) => (
              <rect
                key={rowIndex}
                x={0}
                y={HEADER_HEIGHT + rowIndex * ROW_HEIGHT}
                width={chartWidth}
                height={ROW_HEIGHT}
                fill={rowIndex % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'}
              />
            ))}

            {/* Week vertical lines + headers */}
            {weeks.map(({ label, offset }) => (
              <g key={offset}>
                <line
                  x1={offset * DAY_WIDTH}
                  y1={0}
                  x2={offset * DAY_WIDTH}
                  y2={svgHeight}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeWidth={1}
                />
                <text
                  x={offset * DAY_WIDTH + 4}
                  y={18}
                  fontSize={10}
                  fill="currentColor"
                  opacity={0.5}
                >
                  {label}
                </text>
              </g>
            ))}

            {/* Today line */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <g>
                <line
                  x1={todayOffset * DAY_WIDTH}
                  y1={0}
                  x2={todayOffset * DAY_WIDTH}
                  y2={svgHeight}
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  opacity={0.7}
                />
                <text
                  x={todayOffset * DAY_WIDTH + 3}
                  y={32}
                  fontSize={9}
                  fill="#6366f1"
                  opacity={0.9}
                >
                  Today
                </text>
              </g>
            )}

            {/* Phase bands */}
            {phases.map((phase) => {
              if (!phase.start_date || !phase.end_date) return null;
              const px = daysBetween(projectStart, phase.start_date) * DAY_WIDTH;
              const pw = Math.max(daysBetween(phase.start_date, phase.end_date) * DAY_WIDTH, 1);
              return (
                <rect
                  key={phase.id}
                  x={px}
                  y={0}
                  width={pw}
                  height={HEADER_HEIGHT}
                  fill={phase.color}
                  opacity={0.12}
                />
              );
            })}

            {/* Phase labels */}
            {phases.map((phase) => {
              if (!phase.start_date) return null;
              const px = daysBetween(projectStart, phase.start_date) * DAY_WIDTH;
              return (
                <text
                  key={`label-${phase.id}`}
                  x={px + 4}
                  y={46}
                  fontSize={10}
                  fontWeight={600}
                  fill={phase.color}
                >
                  {phase.name}
                </text>
              );
            })}

            {/* Dependency arrows */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="6"
                markerHeight="4"
                refX="6"
                refY="2"
                orient="auto"
              >
                <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
              </marker>
            </defs>
            {arrows.map((arrow) => {
              const midX = (arrow.x1 + arrow.x2) / 2;
              const path = `M ${arrow.x1} ${arrow.y1} C ${midX} ${arrow.y1} ${midX} ${arrow.y2} ${arrow.x2} ${arrow.y2}`;
              return (
                <path
                  key={arrow.id}
                  d={path}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  fill="none"
                  opacity={0.6}
                  markerEnd="url(#arrowhead)"
                />
              );
            })}

            {/* Task bars */}
            {taskRows.map(({ task, x, width, y }) => {
              const barColor = task.isCritical
                ? '#ef4444'
                : task.is_blocked
                ? '#f59e0b'
                : task.status?.color ?? '#6366f1';

              const isDone = task.status?.status_type === 'done';

              return (
                <g
                  key={task.id}
                  onClick={() => onTaskClick?.(task.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Bar background */}
                  <rect
                    x={x}
                    y={y + 6}
                    width={width}
                    height={ROW_HEIGHT - 12}
                    rx={4}
                    fill={barColor}
                    opacity={isDone ? 0.4 : 0.85}
                  />
                  {/* Progress fill for done tasks */}
                  {isDone && (
                    <rect
                      x={x}
                      y={y + 6}
                      width={width}
                      height={ROW_HEIGHT - 12}
                      rx={4}
                      fill={barColor}
                      opacity={0.3}
                    />
                  )}
                  {/* Task title inside bar (if wide enough) */}
                  {width > 60 && (
                    <text
                      x={x + 6}
                      y={y + ROW_HEIGHT / 2 + 4}
                      fontSize={10}
                      fill="white"
                      fontWeight={500}
                    >
                      {task.title.length > Math.floor(width / 7)
                        ? task.title.slice(0, Math.floor(width / 7)) + '…'
                        : task.title}
                    </text>
                  )}
                  {/* End date label */}
                  {task.due_date && (
                    <text
                      x={x + width + 4}
                      y={y + ROW_HEIGHT / 2 + 4}
                      fontSize={9}
                      fill="currentColor"
                      opacity={0.5}
                    >
                      {formatDate(task.due_date)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Milestone diamonds */}
            {milestones.map((m) => {
              const mx = daysBetween(projectStart, m.due_date) * DAY_WIDTH;
              const my = HEADER_HEIGHT - 8;
              return (
                <g key={m.id}>
                  <title>{m.name}</title>
                  <polygon
                    points={`${mx},${my - 8} ${mx + 8},${my} ${mx},${my + 8} ${mx - 8},${my}`}
                    fill={m.color}
                    opacity={m.status === 'achieved' ? 1 : 0.7}
                  />
                  <text
                    x={mx + 10}
                    y={my + 4}
                    fontSize={9}
                    fill={m.color}
                    fontWeight={600}
                  >
                    {m.name.length > 15 ? m.name.slice(0, 15) + '…' : m.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500 opacity-80" />
          Critical Path
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500 opacity-80" />
          Blocked
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-4 bg-brand-500 opacity-70" />
          Today
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rotate-45 bg-amber-400" />
          Milestone
        </div>
      </div>
    </div>
  );
}
