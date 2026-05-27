import type { Metadata } from "next";
import Link from "next/link";
import { Kanban, Plus, Clock, CheckCircle2, AlertCircle, Users } from "lucide-react";

export const metadata: Metadata = { title: "Projects" };

const sampleProjects = [
  { name: "ZenFlow Platform Dev", status: "ACTIVE", tasks: 48, completed: 31, members: 3, due: "Jun 30, 2026", color: "#6366f1" },
  { name: "Q2 Marketing Campaign", status: "ACTIVE", tasks: 22, completed: 14, members: 5, due: "May 31, 2026", color: "#8b5cf6" },
  { name: "Website Redesign", status: "ON_HOLD", tasks: 35, completed: 10, members: 2, due: "Jul 15, 2026", color: "#06b6d4" },
];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage tasks, sprints, and team work</p>
        </div>
        <Link href="/projects/new" className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sampleProjects.map((project) => {
          const pct = Math.round((project.completed / project.tasks) * 100);
          return (
            <div key={project.name} className="bg-card border border-border rounded-2xl p-6 hover:border-brand-500/30 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-10 rounded-full" style={{ backgroundColor: project.color }} />
                  <div>
                    <h3 className="font-semibold group-hover:text-brand-500 transition-colors">{project.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      project.status === "ACTIVE" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
                    }`}>
                      {project.status === "ACTIVE" ? "Active" : "On Hold"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{project.completed}/{project.tasks} tasks</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: project.color }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {project.members} members
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {project.due}
                </div>
              </div>
            </div>
          );
        })}

        {/* New project card */}
        <Link href="/projects/new" className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-brand-500/10 flex items-center justify-center transition-colors">
            <Plus className="w-5 h-5 text-muted-foreground group-hover:text-brand-500 transition-colors" />
          </div>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-brand-500 transition-colors">
            Create New Project
          </span>
        </Link>
      </div>
    </div>
  );
}
