import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  customers,
  customerAddresses,
  orders,
  orderLineItems,
  orderStatusHistory,
  products,
  discountCodes,
  discountCodeUses,
  recommendationCodes,
  recommendationCodeUses,
  productVariants,
} from "@/lib/db/schema";
import { checkoutSchema } from "@/lib/validators";
import { nanoid } from "nanoid";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { sendOrderConfirmation, sendOwnerNewOrder } from "@/lib/email";
import { computeDiscountAmount } from "@/app/api/validate-discount/route";
import { getSiteSettings } from "@/lib/site-settings";

const checkoutRequestSchema = checkoutSchema.extend({
  items: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().min(1),
    }),
  ),
});

function generateRecommendationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "FC-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FC-${datePart}-${randomPart}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkoutRequestSchema.parse(body);

    if (parsed.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const productIds = parsed.items.map((item) => item.productId);
    const dbProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Fetch variants if needed
    const variantIds = parsed.items.map((i) => i.variantId).filter(Boolean) as string[];
    const dbVariants = variantIds.length > 0
      ? await db.select().from(productVariants).where(inArray(productVariants.id, variantIds))
      : [];
    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    for (const item of parsed.items) {
      const product = productMap.get(item.productId);
      if (!product || product.status !== "active") {
        return NextResponse.json(
          { error: `Product not found or unavailable: ${item.productId}` },
          { status: 400 },
        );
      }

      // Stock check — variant stock takes priority if variantId is present
      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant) {
          return NextResponse.json(
            { error: `Variant not found: ${item.variantId}` },
            { status: 400 },
          );
        }
        if (variant.stock !== null && variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Not enough stock for "${product.title}"` },
            { status: 400 },
          );
        }
      } else if (product.stock !== null && product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for "${product.title}"` },
          { status: 400 },
        );
      }
    }

    // Validate discount code if provided
    let appliedDiscount: {
      id: string;
      code: string;
      type: string;
      value: number;
      discountAmount: number;
      perCustomerLimit: number;
      maxUses: number | null;
      usedCount: number;
    } | null = null;

    if (parsed.discountCode) {
      const discount = db
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.code, parsed.discountCode.toUpperCase()))
        .get();

      if (!discount) {
        return NextResponse.json({ error: "Invalid discount code" }, { status: 400 });
      }
      if (!discount.active) {
        return NextResponse.json({ error: "This discount code is no longer active" }, { status: 400 });
      }
      if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
        return NextResponse.json({ error: "This discount code has expired" }, { status: 400 });
      }
      if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
        return NextResponse.json({ error: "This discount code has reached its usage limit" }, { status: 400 });
      }

      // Per-customer limit check
      const customerUses = db
        .select()
        .from(discountCodeUses)
        .where(
          eq(discountCodeUses.codeId, discount.id),
        )
        .all()
        .filter((u) => u.customerEmail === parsed.email.toLowerCase());

      if (customerUses.length >= discount.perCustomerLimit) {
        return NextResponse.json({ error: "You have already used this discount code" }, { status: 400 });
      }

      // Compute subtotal first to calculate discount
      const tempSubtotal = parsed.items.reduce((sum, item) => {
        const product = productMap.get(item.productId)!;
        const variant = item.variantId ? variantMap.get(item.variantId) : null;
        const unitPrice = variant?.priceOverride ?? product.price;
        return sum + unitPrice * item.quantity;
      }, 0);

      appliedDiscount = {
        ...discount,
        discountAmount: computeDiscountAmount(discount.type, discount.value, tempSubtotal),
      };
    }

    const now = new Date().toISOString();
    const orderId = nanoid();
    const orderNumber = generateOrderNumber();

    const existingCustomer = db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, parsed.email))
      .get();

    const customerId = existingCustomer ? existingCustomer.id : nanoid();

    if (existingCustomer) {
      db.update(customers)
        .set({ updatedAt: now })
        .where(eq(customers.id, existingCustomer.id))
        .run();
    } else {
      db.insert(customers)
        .values({
          id: customerId,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          email: parsed.email,
          phone: parsed.phone,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    db.insert(customerAddresses)
      .values({
        id: nanoid(),
        customerId,
        addressLine1: parsed.addressLine1,
        addressLine2: parsed.addressLine2 ?? null,
        city: parsed.city,
        state: parsed.state ?? null,
        postalCode: parsed.postalCode ?? null,
        country: parsed.country,
        isDefault: true,
      })
      .run();

    const lineItems = parsed.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId ? variantMap.get(item.variantId) : null;
      const unitPrice = variant?.priceOverride ?? product.price;
      return {
        id: nanoid(),
        orderId,
        productId: item.productId,
        variantId: item.variantId ?? null,
        title: product.title,
        quantity: item.quantity,
        unitPrice,
        total: unitPrice * item.quantity,
      };
    });

    const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
    const shippingCost = 0;
    const discountAmount = appliedDiscount?.discountAmount ?? 0;
    const total = Math.max(subtotal + shippingCost - discountAmount, 0);

    const shippingAddress = JSON.stringify({
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2,
      city: parsed.city,
      state: parsed.state,
      postalCode: parsed.postalCode,
      country: parsed.country,
    });

    db.insert(orders)
      .values({
        id: orderId,
        orderNumber,
        customerId,
        status: "pending",
        paymentStatus: parsed.paymentMethod === "cod" ? "unpaid" : "unpaid",
        paymentMethod: parsed.paymentMethod,
        subtotal,
        shippingCost,
        total,
        note: parsed.note ?? null,
        shippingAddress,
        discountCode: appliedDiscount?.code ?? null,
        discountAmount,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (const li of lineItems) {
      db.insert(orderLineItems).values(li).run();
    }

    db.insert(orderStatusHistory)
      .values({
        id: nanoid(),
        orderId,
        fromStatus: null,
        toStatus: "pending",
        note: "Order placed",
        createdAt: now,
      })
      .run();

    // Record discount code use and increment counter
    if (appliedDiscount) {
      db.insert(discountCodeUses)
        .values({
          id: nanoid(),
          codeId: appliedDiscount.id,
          customerEmail: parsed.email.toLowerCase(),
          orderId,
          usedAt: now,
        })
        .run();

      db.update(discountCodes)
        .set({ usedCount: sql`used_count + 1`, updatedAt: now })
        .where(eq(discountCodes.id, appliedDiscount.id))
        .run();
    }

    // Decrement stock atomically for each item
    for (const item of parsed.items) {
      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (variant && variant.stock !== null) {
          db.update(productVariants)
            .set({ stock: sql`stock - ${item.quantity}` })
            .where(eq(productVariants.id, item.variantId))
            .run();
        }
      } else {
        const product = productMap.get(item.productId)!;
        if (product.stock !== null) {
          db.update(products)
            .set({ stock: sql`stock - ${item.quantity}` })
            .where(eq(products.id, item.productId))
            .run();
        }
      }
    }

    // Record recommendation code usage if provided
    if (parsed.recommendationCode) {
      const recCode = db
        .select()
        .from(recommendationCodes)
        .where(eq(recommendationCodes.code, parsed.recommendationCode.toUpperCase()))
        .get();

      if (recCode) {
        db.insert(recommendationCodeUses)
          .values({
            id: nanoid(),
            codeId: recCode.id,
            usedByEmail: parsed.email.toLowerCase(),
            orderId,
            usedAt: now,
          })
          .run();

        db.update(orders)
          .set({ recommendationCode: recCode.code })
          .where(eq(orders.id, orderId))
          .run();
      }
    }

    // Generate recommendation code if feature is enabled
    let newRecCode: string | null = null;
    const settings = await getSiteSettings();
    if (settings.enable_recommendation_codes === "true") {
      newRecCode = generateRecommendationCode();
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const existing = db
          .select()
          .from(recommendationCodes)
          .where(eq(recommendationCodes.code, newRecCode))
          .get();
        if (!existing) break;
        newRecCode = generateRecommendationCode();
        attempts++;
      }

      db.insert(recommendationCodes)
        .values({
          id: nanoid(),
          code: newRecCode,
          orderId,
          customerEmail: parsed.email.toLowerCase(),
          createdAt: now,
        })
        .run();
    }

    // Send order confirmation email (fire-and-forget)
    const emailItems = lineItems.map((li) => ({
      title: li.title,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      total: li.total,
    }));

    sendOrderConfirmation({
      to: parsed.email,
      orderNumber,
      firstName: parsed.firstName,
      items: emailItems,
      subtotal,
      shippingCost,
      total,
      recommendationCode: newRecCode,
    }).catch(() => {});

    // Notify shop owner (fire-and-forget)
    sendOwnerNewOrder({
      orderNumber,
      customerName: `${parsed.firstName} ${parsed.lastName}`,
      email: parsed.email,
      total,
      items: emailItems,
    }).catch(() => {});

    if (parsed.paymentMethod === "stripe") {
      // Stripe integration placeholder
      // In production, create a Stripe Checkout Session here
      return NextResponse.json({
        orderNumber,
        // checkoutUrl: session.url,
        message: "Stripe integration pending. Use COD for now.",
      });
    }

    return NextResponse.json({ orderNumber, recommendationCode: newRecCode });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }
}
