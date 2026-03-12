import { NextRequest } from "next/server";
import { checkoutSchema } from "@/lib/validators";
import { z } from "zod/v4";
import { sendOrderConfirmation, sendOwnerNewOrder } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getRequestId, jsonWithRequestId, logError, logInfo, logWarn } from "@/lib/logging";
import { CheckoutError, processCheckout } from "@/lib/checkout/process-checkout";

const checkoutRequestSchema = checkoutSchema.extend({
  items: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().min(1),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const ip = getClientIp(req);

  try {
    // Rate limit: 10 requests per minute per IP
    const limit = checkRateLimit(`checkout:${ip}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!limit.allowed) {
      logWarn("Checkout request denied by rate limit", {
        requestId,
        route: "/api/checkout",
        ip,
      });
      return jsonWithRequestId(
        requestId,
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const body = await req.json();
    const parsed = checkoutRequestSchema.parse(body);

    logInfo("Checkout request received", {
      requestId,
      route: "/api/checkout",
      ip,
      itemCount: parsed.items.length,
      paymentMethod: parsed.paymentMethod,
    });

    // processCheckout is intentionally synchronous because better-sqlite3
    // transactions are synchronous in this app.
    const result = processCheckout(parsed);

    // Send order confirmation email (fire-and-forget)
    sendOrderConfirmation({
      to: parsed.email,
      orderNumber: result.orderNumber,
      firstName: parsed.firstName,
      items: result.emailItems,
      subtotal: result.subtotal,
      shippingCost: result.shippingCost,
      total: result.total,
      recommendationCode: result.recommendationCode,
    }).catch(() => {});

    // Notify shop owner (fire-and-forget)
    sendOwnerNewOrder({
      orderNumber: result.orderNumber,
      customerName: `${parsed.firstName} ${parsed.lastName}`,
      email: parsed.email,
      total: result.total,
      items: result.emailItems,
    }).catch(() => {});

    logInfo("Checkout completed successfully", {
      requestId,
      route: "/api/checkout",
      ip,
      orderNumber: result.orderNumber,
      paymentMethod: parsed.paymentMethod,
      itemCount: parsed.items.length,
    });

    if (parsed.paymentMethod === "stripe") {
      // Stripe integration placeholder
      // In production, create a Stripe Checkout Session here
      return jsonWithRequestId(requestId, {
        orderNumber: result.orderNumber,
        // checkoutUrl: session.url,
        message: "Stripe integration pending. Use COD for now.",
      });
    }

    return jsonWithRequestId(requestId, {
      orderNumber: result.orderNumber,
      recommendationCode: result.recommendationCode,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn("Checkout request failed validation", {
        requestId,
        route: "/api/checkout",
        ip,
        issueCount: err.issues.length,
      });
      return jsonWithRequestId(
        requestId,
        { error: "Invalid input", details: err.issues },
        { status: 400 },
      );
    }

    if (err instanceof CheckoutError) {
      logWarn("Checkout request rejected", {
        requestId,
        route: "/api/checkout",
        ip,
        error: err.message,
      });
      return jsonWithRequestId(requestId, { error: err.message }, { status: err.status });
    }

    logError("Checkout request failed unexpectedly", {
      requestId,
      route: "/api/checkout",
      ip,
      error: err,
    });
    return jsonWithRequestId(
      requestId,
      { error: "Checkout failed. Please try again." },
      { status: 500 },
    );
  }
}
