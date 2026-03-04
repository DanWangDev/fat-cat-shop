import { db } from "@/lib/db";
import { products, orders, customers } from "@/lib/db/schema";
import { count, eq, sql, inArray } from "drizzle-orm";
import { formatPrice } from "@/lib/utils";
import { DashboardOrderColumn } from "@/components/admin/dashboard-order-column";
import { CancelledOrdersSection } from "@/components/admin/cancelled-orders-section";
import { Sparkline } from "@/components/admin/sparkline";
import { aggregateToday } from "@/lib/analytics";
import Link from "next/link";

function toOrderCard(order: {
  id: string;
  orderNumber: string;
  total: number;
  createdAt: string;
  status: string;
  customer: { firstName: string; lastName: string } | null;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customer
      ? `${order.customer.firstName} ${order.customer.lastName}`
      : "Guest",
    total: order.total,
    createdAt: order.createdAt,
    status: order.status,
  };
}

export default async function AdminDashboardPage() {
  const [productCount] = await db.select({ count: count() }).from(products);
  const [orderCount] = await db.select({ count: count() }).from(orders);
  const [customerCount] = await db.select({ count: count() }).from(customers);
  const [revenueResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"));

  await aggregateToday();

  const last30Days = await db.query.analyticsDailySummary.findMany({
    orderBy: (s, { asc }) => [asc(s.date)],
    limit: 30,
  });
  const revenueData = last30Days.map((d) => d.revenue);
  const ordersData = last30Days.map((d) => d.ordersCount);
  const visitorsData = last30Days.map((d) => d.uniqueVisitors);
  const pageViewsData = last30Days.map((d) => d.pageViews);

  const todaySummary = last30Days.length > 0 ? last30Days[last30Days.length - 1] : null;

  const stats = [
    { label: "Products", value: productCount.count.toString() },
    { label: "Orders", value: orderCount.count.toString(), sparklineData: ordersData, sparklineColor: "#f59e0b" },
    { label: "Customers", value: customerCount.count.toString() },
    { label: "Revenue", value: formatPrice(revenueResult.total), sparklineData: revenueData, sparklineColor: "#0d9488" },
    { label: "Visitors Today", value: (todaySummary?.uniqueVisitors ?? 0).toString(), sparklineData: visitorsData, sparklineColor: "#6366f1" },
    { label: "Page Views Today", value: (todaySummary?.pageViews ?? 0).toString(), sparklineData: pageViewsData, sparklineColor: "#8b5cf6" },
  ];

  const [unfulfilledOrders, shippedOrders, deliveredOrders, cancelledOrders] =
    await Promise.all([
      db.query.orders.findMany({
        with: { customer: true },
        where: inArray(orders.status, ["pending", "confirmed"]),
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        limit: 5,
      }),
      db.query.orders.findMany({
        with: { customer: true },
        where: eq(orders.status, "shipped"),
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        limit: 5,
      }),
      db.query.orders.findMany({
        with: { customer: true },
        where: eq(orders.status, "delivered"),
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        limit: 5,
      }),
      db.query.orders.findMany({
        with: { customer: true },
        where: eq(orders.status, "cancelled"),
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        limit: 5,
      }),
    ]);

  const [unfulfilledCount, shippedCount, deliveredCount, cancelledCount] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(orders)
        .where(inArray(orders.status, ["pending", "confirmed"])),
      db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "shipped")),
      db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "delivered")),
      db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "cancelled")),
    ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-warm-brown">
        Dashboard
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-warm-brown/60">{stat.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-warm-brown">
              {stat.value}
            </p>
            {stat.sparklineData && stat.sparklineData.length >= 2 && (
              <Sparkline
                data={stat.sparklineData}
                color={stat.sparklineColor}
                className="mt-2 h-6 w-full"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 text-right">
        <Link
          href="/admin/analytics"
          className="text-sm font-bold text-teal-primary hover:underline"
        >
          View Full Analytics &rarr;
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardOrderColumn
          title="Unfulfilled"
          accentColor="amber"
          orders={unfulfilledOrders.map(toOrderCard)}
          count={unfulfilledCount[0].count}
        />
        <DashboardOrderColumn
          title="Shipped"
          accentColor="blue"
          orders={shippedOrders.map(toOrderCard)}
          count={shippedCount[0].count}
        />
        <DashboardOrderColumn
          title="Delivered"
          accentColor="green"
          orders={deliveredOrders.map(toOrderCard)}
          count={deliveredCount[0].count}
        />
      </div>

      <div className="mt-4">
        <CancelledOrdersSection
          orders={cancelledOrders.map(toOrderCard)}
          count={cancelledCount[0].count}
        />
      </div>
    </div>
  );
}
