import type { CustomerStats } from "@/lib/analytics-queries";
import { formatPrice } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { StatCard } from "./stat-card";
import { DataTable } from "./data-table";

export function CustomersSection({ data }: { data: CustomerStats }) {
  return (
    <SectionCard title="Customer Insights">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Total Customers" value={data.totalCustomers.toLocaleString()} />
        <StatCard label="New (period)" value={data.newCustomers.toLocaleString()} />
        <StatCard label="Repeat Buyers" value={data.repeatCustomers.toLocaleString()} />
        <StatCard label="Repeat Rate" value={`${data.repeatRate}%`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Top Customers by Revenue</h3>
          <DataTable
            columns={[
              { header: "Customer", accessor: (r) => r.name },
              { header: "Email", accessor: (r) => r.email ?? "—" },
              { header: "Orders", accessor: (r) => r.orders.toLocaleString(), align: "right" },
              { header: "Revenue", accessor: (r) => formatPrice(r.revenue), align: "right" },
            ]}
            rows={data.topCustomers}
            emptyMessage="No customer data yet"
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Geographic Breakdown</h3>
          <DataTable
            columns={[
              { header: "Country", accessor: (r) => r.country },
              { header: "Customers", accessor: (r) => r.customers.toLocaleString(), align: "right" },
            ]}
            rows={data.geoBreakdown}
            emptyMessage="No geographic data yet"
          />
        </div>
      </div>
    </SectionCard>
  );
}
