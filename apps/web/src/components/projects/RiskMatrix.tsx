'use client';

import { cn } from '@/lib/utils';

interface Risk {
  id: string;
  title: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  risk_score: number;
  status: string;
}

interface RiskMatrixProps {
  risks: Risk[];
  onRiskClick?: (riskId: string) => void;
}

const PROB_LEVELS = ['high', 'medium', 'low'] as const;
const IMPACT_LEVELS = ['low', 'medium', 'high'] as const;

const CELL_COLORS: Record<string, string> = {
  '1-1': 'bg-green-500/20',   // low-low
  '1-2': 'bg-green-500/20',   // low-medium
  '1-3': 'bg-amber-500/20',   // low-high
  '2-1': 'bg-green-500/20',   // medium-low
  '2-2': 'bg-amber-500/20',   // medium-medium
  '2-3': 'bg-red-500/20',     // medium-high
  '3-1': 'bg-amber-500/20',   // high-low
  '3-2': 'bg-red-500/20',     // high-medium
  '3-3': 'bg-red-600/30',     // high-high
};

const PROB_WEIGHT = { low: 1, medium: 2, high: 3 };
const IMPACT_WEIGHT = { low: 1, medium: 2, high: 3 };

const RISK_SCORE_COLOR: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-green-500',
  3: 'bg-amber-500',
  4: 'bg-amber-500',
  6: 'bg-orange-500',
  9: 'bg-red-500',
};

function getRiskColor(score: number): string {
  if (score >= 9) return 'bg-red-500';
  if (score >= 6) return 'bg-orange-500';
  if (score >= 4) return 'bg-amber-500';
  if (score >= 3) return 'bg-amber-400';
  return 'bg-green-500';
}

export function RiskMatrix({ risks, onRiskClick }: RiskMatrixProps) {
  const getCellRisks = (prob: string, impact: string) =>
    risks.filter((r) => r.probability === prob && r.impact === impact);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Risk Matrix</h3>
      <div className="relative">
        {/* Y-axis label */}
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground whitespace-nowrap">
          Probability
        </div>

        <div className="pl-4">
          {/* Grid */}
          <div className="flex flex-col gap-1">
            {PROB_LEVELS.map((prob) => (
              <div key={prob} className="flex gap-1 items-center">
                {/* Row label */}
                <div className="w-12 text-[10px] text-muted-foreground text-right pr-2 capitalize">
                  {prob}
                </div>
                {IMPACT_LEVELS.map((impact) => {
                  const cellKey = `${PROB_WEIGHT[prob]}-${IMPACT_WEIGHT[impact]}`;
                  const cellRisks = getCellRisks(prob, impact);
                  return (
                    <div
                      key={impact}
                      className={cn(
                        'w-24 h-20 rounded-lg border border-border/50 flex flex-wrap gap-1 p-1.5 content-start overflow-hidden',
                        CELL_COLORS[cellKey] ?? 'bg-muted/20'
                      )}
                    >
                      {cellRisks.map((risk) => (
                        <button
                          key={risk.id}
                          onClick={() => onRiskClick?.(risk.id)}
                          title={risk.title}
                          className={cn(
                            'w-4 h-4 rounded-full text-white flex items-center justify-center flex-shrink-0 hover:scale-125 transition-transform',
                            getRiskColor(risk.risk_score)
                          )}
                        >
                          <span className="text-[8px] font-bold">{risk.risk_score}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="flex gap-1 mt-1">
            <div className="w-12" />
            {IMPACT_LEVELS.map((impact) => (
              <div key={impact} className="w-24 text-center text-[10px] text-muted-foreground capitalize">
                {impact}
              </div>
            ))}
          </div>

          {/* X-axis label */}
          <div className="text-center text-xs text-muted-foreground mt-1">Impact</div>
        </div>
      </div>

      {/* Score legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium text-foreground">Score:</span>
        {[
          { label: 'Low (1-2)', color: 'bg-green-500' },
          { label: 'Medium (3-4)', color: 'bg-amber-500' },
          { label: 'High (6)', color: 'bg-orange-500' },
          { label: 'Critical (9)', color: 'bg-red-500' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={cn('w-3 h-3 rounded-full', color)} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
