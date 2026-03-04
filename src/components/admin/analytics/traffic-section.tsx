import type { TrafficStats } from "@/lib/analytics-queries";
import { SectionCard } from "./section-card";
import { StatCard } from "./stat-card";
import { DataTable } from "./data-table";

export function TrafficSection({ data }: { data: TrafficStats }) {
  const avgPagesPerVisitor = data.uniqueVisitors > 0
    ? (data.pageViews / data.uniqueVisitors).toFixed(1)
    : "0";

  return (
    <SectionCard title="Traffic & Engagement">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Unique Visitors"
          value={data.uniqueVisitors.toLocaleString()}
          sparklineData={data.dailySeries.map((d) => d.visitors)}
          sparklineColor="#0d9488"
        />
        <StatCard
          label="Page Views"
          value={data.pageViews.toLocaleString()}
          sparklineData={data.dailySeries.map((d) => d.views)}
          sparklineColor="#6366f1"
        />
        <StatCard label="Avg. Pages / Visitor" value={avgPagesPerVisitor} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Top Pages</h3>
          <DataTable
            columns={[
              { header: "Page", accessor: (r) => r.path },
              { header: "Views", accessor: (r) => r.views.toLocaleString(), align: "right" },
              {
                header: "% of Total",
                accessor: (r) => data.pageViews > 0 ? `${Math.round((r.views / data.pageViews) * 100)}%` : "0%",
                align: "right",
              },
            ]}
            rows={data.topPages}
            emptyMessage="No pageview data yet"
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Traffic Sources</h3>
          <DataTable
            columns={[
              { header: "Source", accessor: (r) => r.source },
              { header: "Sessions", accessor: (r) => r.sessions.toLocaleString(), align: "right" },
            ]}
            rows={data.referrerBreakdown}
            emptyMessage="No referrer data yet"
          />
        </div>
      </div>
    </SectionCard>
  );
}
