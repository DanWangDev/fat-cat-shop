import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discountCodes, discountCodeUses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { computeDiscountAmount } from "@/lib/discounts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const subtotalParam = searchParams.get("subtotal");
  const email = searchParams.get("email");

  if (!code || !subtotalParam) {
    return NextResponse.json(
      { valid: false, error: "Missing code or subtotal" },
      { status: 400 },
    );
  }

  const subtotal = parseInt(subtotalParam, 10);
  if (isNaN(subtotal) || subtotal < 0) {
    return NextResponse.json(
      { valid: false, error: "Invalid subtotal" },
      { status: 400 },
    );
  }

  const discount = db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, code.toUpperCase()))
    .get();

  if (!discount) {
    return NextResponse.json({ valid: false, error: "Code not found" });
  }

  if (!discount.active) {
    return NextResponse.json({ valid: false, error: "This code is no longer active" });
  }

  if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
    return NextResponse.json({ valid: false, error: "This code has expired" });
  }

  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
    return NextResponse.json({ valid: false, error: "This code has reached its usage limit" });
  }

  // Check per-customer limit if email is provided
  if (email) {
    const customerUses = db
      .select()
      .from(discountCodeUses)
      .where(
        and(
          eq(discountCodeUses.codeId, discount.id),
          eq(discountCodeUses.customerEmail, email.toLowerCase()),
        ),
      )
      .all();

    if (customerUses.length >= discount.perCustomerLimit) {
      return NextResponse.json({
        valid: false,
        error: "You have already used this code",
      });
    }
  }

  const discountAmount = computeDiscountAmount(discount.type, discount.value, subtotal);

  return NextResponse.json({
    valid: true,
    discountAmount,
    type: discount.type,
    value: discount.value,
    code: discount.code,
  });
}
