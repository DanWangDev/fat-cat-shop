import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getTrafficStats,
  getFunnelStats,
  getProductStats,
  getCustomerStats,
  getCampaignStats,
  getRevenueStats,
} from "@/lib/analytics-queries";
import { DateRangeTabs } from "@/components/admin/analytics/date-range-tabs";
import { TrafficSection } from "@/components/admin/analytics/traffic-section";
import { FunnelSection } from "@/components/admin/analytics/funnel-section";
import { ProductsSection } from "@/components/admin/analytics/products-section";
import { CustomersSection } from "@/components/admin/analytics/customers-section";
import { CampaignsSection } from "@/components/admin/analytics/campaigns-section";
import { RevenueSection } from "@/components/admin/analytics/revenue-section";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const authed = await isAuthenticated();
  if (!authed) redirect("/admin/login");

  const { range = "30d" } = await searchParams;
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const results = await Promise.allSettled([
    getTrafficStats(sinceStr),
    getFunnelStats(sinceStr),
    getProductStats(sinceStr),
    getCustomerStats(sinceStr),
    getCampaignStats(sinceStr),
    getRevenueStats(sinceStr),
  ]);

  const traffic = results[0].status === "fulfilled" ? results[0].value : { uniqueVisitors: 0, pageViews: 0, dailySeries: [], topPages: [], referrerBreakdown: [] };
  const funnel = results[1].status === "fulfilled" ? results[1].value : { stages: [] };
  const products = results[2].status === "fulfilled" ? results[2].value : { bestSellers: [], revenueByCategory: [] };
  const customers = results[3].status === "fulfilled" ? results[3].value : { newCustomers: 0, totalCustomers: 0, repeatCustomers: 0, repeatRate: 0, topCustomers: [], geoBreakdown: [] };
  const campaigns = results[4].status === "fulfilled" ? results[4].value : { discountPerf: [], recCodePerf: [] };
  const revenue = results[5].status === "fulfilled" ? results[5].value : { totalRevenue: 0, orderCount: 0, avgOrderValue: 0, totalDiscounts: 0, dailySeries: [], paymentMethodBreakdown: [] };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-warm-brown">Analytics</h1>
        <DateRangeTabs range={range === "7d" || range === "90d" ? range : "30d"} />
      </div>

      <div className="mt-6 space-y-6">
        <RevenueSection data={revenue} />
        <TrafficSection data={traffic} />
        <FunnelSection data={funnel} />
        <ProductsSection data={products} />
        <CustomersSection data={customers} />
        <CampaignsSection data={campaigns} />
      </div>
    </div>
  );
}
