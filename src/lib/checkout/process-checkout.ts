import crypto from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { type DiscountType, computeDiscountAmount } from "@/lib/discounts";
import { db } from "@/lib/db";
import {
  customerAddresses,
  customers,
  discountCodeUses,
  discountCodes,
  orderLineItems,
  orders,
  orderStatusHistory,
  productVariants,
  products,
  recommendationCodes,
  recommendationCodeUses,
  siteSettings,
} from "@/lib/db/schema";

export interface CheckoutItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ProcessCheckoutInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  paymentMethod: "stripe" | "cod";
  note?: string;
  discountCode?: string;
  recommendationCode?: string;
  items: CheckoutItemInput[];
}

export interface CheckoutEmailItem {
  title: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ProcessCheckoutResult {
  orderNumber: string;
  recommendationCode: string | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  emailItems: CheckoutEmailItem[];
}

interface AppliedDiscount {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  discountAmount: number;
  perCustomerLimit: number;
}

export class CheckoutError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

function generateRecommendationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "FC-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
  const bytes = crypto.randomBytes(3);
  const randomPart = bytes.toString("hex").slice(0, 4).toUpperCase();
  return `FC-${datePart}-${randomPart}`;
}

function getMutationChanges(result: unknown): number {
  if (
    typeof result === "object" &&
    result !== null &&
    "changes" in result &&
    typeof (result as { changes?: unknown }).changes === "number"
  ) {
    return (result as { changes: number }).changes;
  }
  throw new Error(
    `getMutationChanges: unexpected result shape: ${JSON.stringify(result)}`,
  );
}

export function processCheckout(input: ProcessCheckoutInput): ProcessCheckoutResult {
  if (input.items.length === 0) {
    throw new CheckoutError("Cart is empty");
  }

  const now = new Date().toISOString();
  const orderId = nanoid();
  const customerEmail = input.email.toLowerCase();

  return db.transaction((tx) => {
    let enableRecommendationCodes = false;
    try {
      const setting = tx
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, "enable_recommendation_codes"))
        .get();
      enableRecommendationCodes = setting?.value === "true";
    } catch {
      enableRecommendationCodes = false;
    }

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const dbProducts = tx
      .select()
      .from(products)
      .where(inArray(products.id, productIds))
      .all();
    const productMap = new Map(dbProducts.map((product) => [product.id, product]));

    const variantIds = [
      ...new Set(
        input.items
          .map((item) => item.variantId)
          .filter((variantId): variantId is string => Boolean(variantId)),
      ),
    ];
    const dbVariants = variantIds.length > 0
      ? tx.select().from(productVariants).where(inArray(productVariants.id, variantIds)).all()
      : [];
    const variantMap = new Map(dbVariants.map((variant) => [variant.id, variant]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product || product.status !== "active") {
        throw new CheckoutError("One or more products are unavailable");
      }

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== product.id) {
          throw new CheckoutError("Selected option is no longer available");
        }
        if (variant.stock !== null && variant.stock < item.quantity) {
          throw new CheckoutError(`Not enough stock for "${product.title}"`);
        }
      } else if (product.stock !== null && product.stock < item.quantity) {
        throw new CheckoutError(`Not enough stock for "${product.title}"`);
      }
    }

    const lineItems = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new CheckoutError("One or more products are unavailable");
      }
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

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const shippingCost = 0;
    let appliedDiscount: AppliedDiscount | null = null;

    if (input.discountCode) {
      const normalizedCode = input.discountCode.trim().toUpperCase();
      const discount = tx
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.code, normalizedCode))
        .get();

      if (!discount) {
        throw new CheckoutError("Invalid discount code");
      }
      if (!discount.active) {
        throw new CheckoutError("This discount code is no longer active");
      }
      if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
        throw new CheckoutError("This discount code has expired");
      }
      if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
        throw new CheckoutError("This discount code has reached its usage limit");
      }

      const customerUseCount = tx
        .select({ count: sql<number>`count(*)` })
        .from(discountCodeUses)
        .where(
          and(
            eq(discountCodeUses.codeId, discount.id),
            eq(discountCodeUses.customerEmail, customerEmail),
          ),
        )
        .get();

      if ((customerUseCount?.count ?? 0) >= discount.perCustomerLimit) {
        throw new CheckoutError("You have already used this discount code");
      }

      appliedDiscount = {
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        discountAmount: computeDiscountAmount(discount.type, discount.value, subtotal),
        perCustomerLimit: discount.perCustomerLimit,
      };
    }

    const existingCustomer = tx
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, customerEmail))
      .get();

    const customerId = existingCustomer ? existingCustomer.id : nanoid();

    if (existingCustomer) {
      tx.update(customers)
        .set({ updatedAt: now })
        .where(eq(customers.id, existingCustomer.id))
        .run();
    } else {
      tx.insert(customers)
        .values({
          id: customerId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: customerEmail,
          phone: input.phone,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    tx.insert(customerAddresses)
      .values({
        id: nanoid(),
        customerId,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        city: input.city,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country,
        isDefault: true,
      })
      .run();

    const discountAmount = appliedDiscount?.discountAmount ?? 0;
    const total = Math.max(subtotal + shippingCost - discountAmount, 0);

    const shippingAddress = JSON.stringify({
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
    });

    let orderNumber = "";
    {
      let orderInserted = false;
      for (let attempts = 0; attempts < 10; attempts++) {
        const candidate = generateOrderNumber();
        const insertResult = tx
          .insert(orders)
          .values({
            id: orderId,
            orderNumber: candidate,
            customerId,
            status: "pending",
            paymentStatus: "unpaid",
            paymentMethod: input.paymentMethod,
            subtotal,
            shippingCost,
            total,
            note: input.note ?? null,
            shippingAddress,
            discountCode: appliedDiscount?.code ?? null,
            discountAmount,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .run();

        if (getMutationChanges(insertResult) > 0) {
          orderNumber = candidate;
          orderInserted = true;
          break;
        }
      }

      if (!orderInserted) {
        throw new CheckoutError("Could not generate unique order number", 500);
      }
    }

    for (const lineItem of lineItems) {
      tx.insert(orderLineItems).values(lineItem).run();
    }

    tx.insert(orderStatusHistory)
      .values({
        id: nanoid(),
        orderId,
        fromStatus: null,
        toStatus: "pending",
        note: "Order placed",
        createdAt: now,
      })
      .run();

    if (appliedDiscount) {
      // NOTE: The usedCount increment is not idempotent. This checkout flow
      // assumes single-attempt execution within one transaction. If application-
      // level retry is added in the future, an idempotency key must gate this
      // increment to prevent double-counting.
      const discountUpdateResult = tx
        .update(discountCodes)
        .set({ usedCount: sql`used_count + 1`, updatedAt: now })
        .where(
          and(
            eq(discountCodes.id, appliedDiscount.id),
            eq(discountCodes.active, true),
            sql`(${discountCodes.maxUses} IS NULL OR ${discountCodes.usedCount} < ${discountCodes.maxUses})`,
            sql`(${discountCodes.expiresAt} IS NULL OR ${discountCodes.expiresAt} > ${now})`,
          ),
        )
        .run();

      if (getMutationChanges(discountUpdateResult) < 1) {
        throw new CheckoutError("This discount code is no longer available");
      }

      const customerUseCount = tx
        .select({ count: sql<number>`count(*)` })
        .from(discountCodeUses)
        .where(
          and(
            eq(discountCodeUses.codeId, appliedDiscount.id),
            eq(discountCodeUses.customerEmail, customerEmail),
          ),
        )
        .get();

      if ((customerUseCount?.count ?? 0) >= appliedDiscount.perCustomerLimit) {
        throw new CheckoutError("You have already used this discount code");
      }

      tx.insert(discountCodeUses)
        .values({
          id: nanoid(),
          codeId: appliedDiscount.id,
          customerEmail,
          orderId,
          usedAt: now,
        })
        .run();
    }

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new CheckoutError("One or more products are unavailable");
      }

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== product.id) {
          throw new CheckoutError("Selected option is no longer available");
        }
        if (variant.stock !== null) {
          const variantUpdateResult = tx
            .update(productVariants)
            .set({ stock: sql`stock - ${item.quantity}` })
            .where(
              and(
                eq(productVariants.id, item.variantId),
                sql`stock >= ${item.quantity}`,
              ),
            )
            .run();

          if (getMutationChanges(variantUpdateResult) < 1) {
            throw new CheckoutError(`Not enough stock for "${product.title}"`);
          }
        }
      } else if (product.stock !== null) {
        const productUpdateResult = tx
          .update(products)
          .set({ stock: sql`stock - ${item.quantity}` })
          .where(
            and(
              eq(products.id, item.productId),
              sql`stock >= ${item.quantity}`,
            ),
          )
          .run();

        if (getMutationChanges(productUpdateResult) < 1) {
          throw new CheckoutError(`Not enough stock for "${product.title}"`);
        }
      }
    }

    if (input.recommendationCode) {
      const normalizedCode = input.recommendationCode.trim().toUpperCase();
      const recommendation = tx
        .select()
        .from(recommendationCodes)
        .where(eq(recommendationCodes.code, normalizedCode))
        .get();

      if (recommendation) {
        tx.insert(recommendationCodeUses)
          .values({
            id: nanoid(),
            codeId: recommendation.id,
            usedByEmail: customerEmail,
            orderId,
            usedAt: now,
          })
          .run();

        tx.update(orders)
          .set({ recommendationCode: recommendation.code })
          .where(eq(orders.id, orderId))
          .run();
      }
    }

    let newRecommendationCode: string | null = null;
    if (enableRecommendationCodes) {
      let inserted = false;
      for (let attempts = 0; attempts < 10; attempts++) {
        const candidate = generateRecommendationCode();
        const insertResult = tx
          .insert(recommendationCodes)
          .values({
            id: nanoid(),
            code: candidate,
            orderId,
            customerEmail,
            createdAt: now,
          })
          .onConflictDoNothing()
          .run();

        if (getMutationChanges(insertResult) > 0) {
          newRecommendationCode = candidate;
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        throw new CheckoutError("Could not generate recommendation code", 500);
      }
    }

    return {
      orderNumber,
      recommendationCode: newRecommendationCode,
      subtotal,
      shippingCost,
      total,
      emailItems: lineItems.map((lineItem) => ({
        title: lineItem.title,
        quantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
        total: lineItem.total,
      })),
    };
  });
}
