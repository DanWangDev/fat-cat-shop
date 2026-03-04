import type { FunnelStats } from "@/lib/analytics-queries";
import { SectionCard } from "./section-card";

export function FunnelSection({ data }: { data: FunnelStats }) {
  const maxVisitors = Math.max(...data.stages.map((s) => s.visitors), 1);

  return (
    <SectionCard title="Conversion Funnel">
      {data.stages.length === 0 ? (
        <p className="py-4 text-center text-sm text-warm-brown/50">No funnel data yet</p>
      ) : (
        <div className="space-y-3">
          {data.stages.map((stage, i) => (
            <div key={stage.event} className="flex items-center gap-4">
              <div className="w-28 flex-shrink-0 text-right">
                <p className="text-sm font-bold text-warm-brown">{stage.label}</p>
                {i > 0 && (
                  <p className="text-xs text-warm-brown/50">{stage.rate}% from prev</p>
                )}
              </div>
              <div className="flex-1">
                <div className="h-8 rounded bg-warm-brown/5">
                  <div
                    className="flex h-full items-center rounded px-3 text-xs font-bold text-white"
                    style={{
                      width: `${Math.max((stage.visitors / maxVisitors) * 100, 2)}%`,
                      backgroundColor: funnelColors[i] ?? "#6b7280",
                    }}
                  >
                    {stage.visitors > 0 ? stage.visitors.toLocaleString() : ""}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {data.stages.length >= 2 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-teal-primary/5 px-4 py-3">
              <span className="text-sm text-warm-brown/60">Overall conversion:</span>
              <span className="font-display text-lg font-bold text-teal-primary">
                {data.stages[0].visitors > 0
                  ? `${((data.stages[data.stages.length - 1].visitors / data.stages[0].visitors) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
              <span className="text-xs text-warm-brown/50">
                ({data.stages[data.stages.length - 1].visitors} of {data.stages[0].visitors} visitors)
              </span>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

const funnelColors = ["#0d9488", "#0891b2", "#6366f1", "#f59e0b", "#10b981"];
