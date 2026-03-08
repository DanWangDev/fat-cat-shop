import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { orders, orderLineItems, orderStatusHistory, customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const trackSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  email: z.string().email("Valid email is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = trackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const { orderNumber, email } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: {
        customer: true,
        lineItems: true,
        statusHistory: true,
      },
    });

    if (!order || !order.customer || order.customer.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Order not found. Please check your order number and email." },
        { status: 404 }
      );
    }

    let shippingAddress = null;
    if (order.shippingAddress) {
      try {
        shippingAddress = JSON.parse(order.shippingAddress);
      } catch {
        shippingAddress = null;
      }
    }

    const statusHistory = order.statusHistory
      .map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        createdAt: entry.createdAt,
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const lineItems = order.lineItems.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    }));

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total,
      createdAt: order.createdAt,
      lineItems,
      statusHistory,
      shippingAddress,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to track order" },
      { status: 500 }
    );
  }
}
