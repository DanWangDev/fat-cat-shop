import type { RevenueStats } from "@/lib/analytics-queries";
import { formatPrice } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { StatCard } from "./stat-card";
import { DataTable } from "./data-table";

export function RevenueSection({ data }: { data: RevenueStats }) {
  const totalMethodRevenue = data.paymentMethodBreakdown.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <SectionCard title="Revenue">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatPrice(data.totalRevenue)}
          sparklineData={data.dailySeries.map((d) => d.revenue)}
          sparklineColor="#0d9488"
        />
        <StatCard
          label="Orders"
          value={data.orderCount.toLocaleString()}
          sparklineData={data.dailySeries.map((d) => d.orders)}
          sparklineColor="#f59e0b"
        />
        <StatCard label="Avg. Order Value" value={formatPrice(data.avgOrderValue)} />
        <StatCard label="Total Discounts" value={formatPrice(data.totalDiscounts)} />
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Payment Method Breakdown</h3>
        <DataTable
          columns={[
            { header: "Method", accessor: (r) => r.method === "cod" ? "Cash on Delivery" : "Stripe" },
            { header: "Orders", accessor: (r) => r.count.toLocaleString(), align: "right" },
            { header: "Revenue", accessor: (r) => formatPrice(r.revenue), align: "right" },
            {
              header: "% of Revenue",
              accessor: (r) => totalMethodRevenue > 0 ? `${Math.round((r.revenue / totalMethodRevenue) * 100)}%` : "0%",
              align: "right",
            },
          ]}
          rows={data.paymentMethodBreakdown}
          emptyMessage="No paid orders yet"
        />
      </div>
    </SectionCard>
  );
}
