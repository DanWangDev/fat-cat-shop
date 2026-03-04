import { db } from "@/lib/db";
import {
  analyticsEvents,
  analyticsDailySummary,
  orders,
  orderLineItems,
  customers,
  customerAddresses,
  discountCodes,
  discountCodeUses,
  recommendationCodes,
  recommendationCodeUses,
  products,
  categories,
} from "@/lib/db/schema";
import { eq, and, gte, sql, inArray } from "drizzle-orm";

// ── Traffic Stats ──────────────────────────────────────────────────

export interface TrafficStats {
  uniqueVisitors: number;
  pageViews: number;
  dailySeries: { date: string; visitors: number; views: number }[];
  topPages: { path: string; views: number }[];
  referrerBreakdown: { source: string; sessions: number }[];
}

export async function getTrafficStats(since: string): Promise<TrafficStats> {
  try {
    const [totals] = await db
      .select({
        uniqueVisitors: sql<number>`COUNT(DISTINCT ${analyticsEvents.visitorId})`,
        pageViews: sql<number>`COUNT(*)`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, "pageview"), gte(analyticsEvents.createdAt, since)));

    const topPages = await db
      .select({
        path: analyticsEvents.path,
        views: sql<number>`COUNT(*)`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, "pageview"), gte(analyticsEvents.createdAt, since)))
      .groupBy(analyticsEvents.path)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    const rawReferrers = await db
      .select({
        referrer: analyticsEvents.referrer,
        count: sql<number>`COUNT(DISTINCT ${analyticsEvents.visitorId})`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, "pageview"), gte(analyticsEvents.createdAt, since)))
      .groupBy(analyticsEvents.referrer)
      .orderBy(sql`COUNT(DISTINCT ${analyticsEvents.visitorId}) DESC`)
      .limit(20);

    const referrerMap = new Map<string, number>();
    for (const r of rawReferrers) {
      let source = "Direct";
      if (r.referrer) {
        try {
          source = new URL(r.referrer).hostname;
        } catch {
          source = r.referrer;
        }
      }
      referrerMap.set(source, (referrerMap.get(source) ?? 0) + r.count);
    }
    const referrerBreakdown = Array.from(referrerMap.entries())
      .map(([source, sessions]) => ({ source, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);

    const dailySeries = await db
      .select({
        date: sql<string>`substr(${analyticsEvents.createdAt}, 1, 10)`,
        visitors: sql<number>`COUNT(DISTINCT ${analyticsEvents.visitorId})`,
        views: sql<number>`COUNT(*)`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, "pageview"), gte(analyticsEvents.createdAt, since)))
      .groupBy(sql`substr(${analyticsEvents.createdAt}, 1, 10)`)
      .orderBy(sql`substr(${analyticsEvents.createdAt}, 1, 10) ASC`);

    return {
      uniqueVisitors: totals.uniqueVisitors ?? 0,
      pageViews: totals.pageViews ?? 0,
      dailySeries,
      topPages,
      referrerBreakdown,
    };
  } catch {
    return { uniqueVisitors: 0, pageViews: 0, dailySeries: [], topPages: [], referrerBreakdown: [] };
  }
}

// ── Funnel Stats ───────────────────────────────────────────────────

export interface FunnelStage {
  event: string;
  label: string;
  visitors: number;
  rate: number;
}

export interface FunnelStats {
  stages: FunnelStage[];
}

export async function getFunnelStats(since: string): Promise<FunnelStats> {
  try {
    const stageRows = await db
      .select({
        event: analyticsEvents.event,
        visitors: sql<number>`COUNT(DISTINCT ${analyticsEvents.visitorId})`,
      })
      .from(analyticsEvents)
      .where(
        and(
          inArray(analyticsEvents.event, ["pageview", "product_view", "add_to_cart", "checkout_started", "purchase"]),
          gte(analyticsEvents.createdAt, since),
        ),
      )
      .groupBy(analyticsEvents.event);

    const stageMap = new Map(stageRows.map((r) => [r.event, r.visitors]));
    const stageOrder = [
      { event: "pageview", label: "Visitors" },
      { event: "product_view", label: "Product Views" },
      { event: "add_to_cart", label: "Add to Cart" },
      { event: "checkout_started", label: "Checkout" },
      { event: "purchase", label: "Purchase" },
    ];

    const stages = stageOrder.map((s, i) => {
      const visitors = stageMap.get(s.event) ?? 0;
      const prev = i === 0 ? visitors : (stageMap.get(stageOrder[i - 1].event) ?? 0);
      return {
        event: s.event,
        label: s.label,
        visitors,
        rate: prev > 0 ? Math.round((visitors / prev) * 100) : 0,
      };
    });

    return { stages };
  } catch {
    return { stages: [] };
  }
}

// ── Product Stats ──────────────────────────────────────────────────

export interface ProductStats {
  bestSellers: { productId: string | null; title: string; unitsSold: number; revenue: number }[];
  revenueByCategory: { category: string; orders: number; revenue: number }[];
}

export async function getProductStats(since: string): Promise<ProductStats> {
  try {
    const bestSellers = await db
      .select({
        productId: orderLineItems.productId,
        title: orderLineItems.title,
        unitsSold: sql<number>`SUM(${orderLineItems.quantity})`,
        revenue: sql<number>`SUM(${orderLineItems.total})`,
      })
      .from(orderLineItems)
      .innerJoin(orders, eq(orderLineItems.orderId, orders.id))
      .where(and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)))
      .groupBy(orderLineItems.productId, orderLineItems.title)
      .orderBy(sql`SUM(${orderLineItems.total}) DESC`)
      .limit(10);

    const revenueByCategory = await db
      .select({
        category: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
        orders: sql<number>`COUNT(DISTINCT ${orders.id})`,
        revenue: sql<number>`SUM(${orderLineItems.total})`,
      })
      .from(orderLineItems)
      .innerJoin(orders, eq(orderLineItems.orderId, orders.id))
      .leftJoin(products, eq(orderLineItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)))
      .groupBy(categories.name)
      .orderBy(sql`SUM(${orderLineItems.total}) DESC`);

    return { bestSellers, revenueByCategory };
  } catch {
    return { bestSellers: [], revenueByCategory: [] };
  }
}

// ── Customer Stats ─────────────────────────────────────────────────

export interface CustomerStats {
  newCustomers: number;
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  topCustomers: { name: string; email: string | null; orders: number; revenue: number }[];
  geoBreakdown: { country: string; customers: number }[];
}

export async function getCustomerStats(since: string): Promise<CustomerStats> {
  try {
    const [newCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(customers)
      .where(gte(customers.createdAt, since));

    const [totalCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(customers);

    const repeatRows = await db
      .select({
        customerId: orders.customerId,
        orderCount: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(eq(orders.paymentStatus, "paid"))
      .groupBy(orders.customerId);

    const customersWithOrders = repeatRows.filter((r) => r.customerId);
    const repeatCustomers = customersWithOrders.filter((r) => r.orderCount > 1).length;
    const repeatRate = customersWithOrders.length > 0
      ? Math.round((repeatCustomers / customersWithOrders.length) * 100)
      : 0;

    const topCustomers = await db
      .select({
        name: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
        email: customers.email,
        orders: sql<number>`COUNT(${orders.id})`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)))
      .groupBy(customers.id)
      .orderBy(sql`SUM(${orders.total}) DESC`)
      .limit(10);

    const geoBreakdown = await db
      .select({
        country: customerAddresses.country,
        customers: sql<number>`COUNT(DISTINCT ${customerAddresses.customerId})`,
      })
      .from(customerAddresses)
      .groupBy(customerAddresses.country)
      .orderBy(sql`COUNT(DISTINCT ${customerAddresses.customerId}) DESC`)
      .limit(15);

    return {
      newCustomers: newCount.count ?? 0,
      totalCustomers: totalCount.count ?? 0,
      repeatCustomers,
      repeatRate,
      topCustomers,
      geoBreakdown,
    };
  } catch {
    return { newCustomers: 0, totalCustomers: 0, repeatCustomers: 0, repeatRate: 0, topCustomers: [], geoBreakdown: [] };
  }
}

// ── Campaign Stats ─────────────────────────────────────────────────

export interface CampaignStats {
  discountPerf: { code: string; type: string; value: number; uses: number; revenue: number; savings: number }[];
  recCodePerf: { code: string; ownerEmail: string; timesUsed: number; referredRevenue: number }[];
}

export async function getCampaignStats(_since: string): Promise<CampaignStats> {
  try {
    const discountPerf = await db
      .select({
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        uses: sql<number>`COUNT(${discountCodeUses.id})`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        savings: sql<number>`COALESCE(SUM(${orders.discountAmount}), 0)`,
      })
      .from(discountCodes)
      .leftJoin(discountCodeUses, eq(discountCodeUses.codeId, discountCodes.id))
      .leftJoin(orders, eq(orders.id, discountCodeUses.orderId))
      .groupBy(discountCodes.id, discountCodes.code)
      .orderBy(sql`COUNT(${discountCodeUses.id}) DESC`);

    const recCodePerf = await db
      .select({
        code: recommendationCodes.code,
        ownerEmail: recommendationCodes.customerEmail,
        timesUsed: sql<number>`COUNT(${recommendationCodeUses.id})`,
        referredRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      })
      .from(recommendationCodes)
      .leftJoin(recommendationCodeUses, eq(recommendationCodeUses.codeId, recommendationCodes.id))
      .leftJoin(orders, eq(orders.id, recommendationCodeUses.orderId))
      .groupBy(recommendationCodes.id, recommendationCodes.code, recommendationCodes.customerEmail)
      .orderBy(sql`COUNT(${recommendationCodeUses.id}) DESC`)
      .limit(20);

    return { discountPerf, recCodePerf };
  } catch {
    return { discountPerf: [], recCodePerf: [] };
  }
}

// ── Revenue Stats ──────────────────────────────────────────────────

export interface RevenueStats {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  totalDiscounts: number;
  dailySeries: { date: string; revenue: number; orders: number }[];
  paymentMethodBreakdown: { method: string; count: number; revenue: number }[];
}

export async function getRevenueStats(since: string): Promise<RevenueStats> {
  try {
    const [overview] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        orderCount: sql<number>`COUNT(*)`,
        avgOrderValue: sql<number>`COALESCE(AVG(${orders.total}), 0)`,
        totalDiscounts: sql<number>`COALESCE(SUM(${orders.discountAmount}), 0)`,
      })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)));

    const paymentMethodBreakdown = await db
      .select({
        method: orders.paymentMethod,
        count: sql<number>`COUNT(*)`,
        revenue: sql<number>`SUM(${orders.total})`,
      })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)))
      .groupBy(orders.paymentMethod);

    const dailySeries = await db
      .select({
        date: sql<string>`substr(${orders.createdAt}, 1, 10)`,
        revenue: sql<number>`SUM(${orders.total})`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)))
      .groupBy(sql`substr(${orders.createdAt}, 1, 10)`)
      .orderBy(sql`substr(${orders.createdAt}, 1, 10) ASC`);

    return {
      totalRevenue: overview.totalRevenue ?? 0,
      orderCount: overview.orderCount ?? 0,
      avgOrderValue: Math.round(overview.avgOrderValue ?? 0),
      totalDiscounts: overview.totalDiscounts ?? 0,
      dailySeries,
      paymentMethodBreakdown,
    };
  } catch {
    return { totalRevenue: 0, orderCount: 0, avgOrderValue: 0, totalDiscounts: 0, dailySeries: [], paymentMethodBreakdown: [] };
  }
}
