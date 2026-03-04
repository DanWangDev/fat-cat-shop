import type { ProductStats } from "@/lib/analytics-queries";
import { formatPrice } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { DataTable } from "./data-table";

export function ProductsSection({ data }: { data: ProductStats }) {
  const rankedSellers = data.bestSellers.map((r, i) => ({ ...r, rank: i + 1 }));

  return (
    <SectionCard title="Product Performance">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Best Sellers</h3>
          <DataTable
            columns={[
              { header: "#", accessor: (r) => r.rank, align: "right" },
              { header: "Product", accessor: (r) => r.title },
              { header: "Units", accessor: (r) => r.unitsSold.toLocaleString(), align: "right" },
              { header: "Revenue", accessor: (r) => formatPrice(r.revenue), align: "right" },
            ]}
            rows={rankedSellers}
            emptyMessage="No sales data yet"
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Revenue by Category</h3>
          <DataTable
            columns={[
              { header: "Category", accessor: (r) => r.category },
              { header: "Orders", accessor: (r) => r.orders.toLocaleString(), align: "right" },
              { header: "Revenue", accessor: (r) => formatPrice(r.revenue), align: "right" },
            ]}
            rows={data.revenueByCategory}
            emptyMessage="No category data yet"
          />
        </div>
      </div>
    </SectionCard>
  );
}
