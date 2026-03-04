import type { CampaignStats } from "@/lib/analytics-queries";
import { formatPrice } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { DataTable } from "./data-table";

function formatDiscountValue(type: string, value: number): string {
  if (type === "percentage") {
    return `${(value / 100).toFixed(0)}% off`;
  }
  return `${formatPrice(value)} off`;
}

export function CampaignsSection({ data }: { data: CampaignStats }) {
  return (
    <SectionCard title="Marketing Campaigns">
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Discount Code Performance</h3>
          <DataTable
            columns={[
              { header: "Code", accessor: (r) => r.code },
              { header: "Discount", accessor: (r) => formatDiscountValue(r.type, r.value) },
              { header: "Uses", accessor: (r) => r.uses.toLocaleString(), align: "right" },
              { header: "Revenue", accessor: (r) => formatPrice(r.revenue), align: "right" },
              { header: "Savings Given", accessor: (r) => formatPrice(r.savings), align: "right" },
            ]}
            rows={data.discountPerf}
            emptyMessage="No discount codes created yet"
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-warm-brown/60">Recommendation Code Activity</h3>
          <DataTable
            columns={[
              { header: "Code", accessor: (r) => r.code },
              { header: "Owner", accessor: (r) => r.ownerEmail },
              { header: "Referrals", accessor: (r) => r.timesUsed.toLocaleString(), align: "right" },
              { header: "Referred Revenue", accessor: (r) => formatPrice(r.referredRevenue), align: "right" },
            ]}
            rows={data.recCodePerf}
            emptyMessage="No recommendation codes generated yet"
          />
        </div>
      </div>
    </SectionCard>
  );
}
