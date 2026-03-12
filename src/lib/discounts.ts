export type DiscountType = "percentage" | "fixed";

export function computeDiscountAmount(
  type: DiscountType,
  value: number,
  subtotal: number,
): number {
  if (type === "percentage") {
    // value is in basis points (1000 = 10%)
    return Math.min(Math.floor((subtotal * value) / 10000), subtotal);
  }
  if (type === "fixed") {
    // value is in cents
    return Math.min(value, subtotal);
  }
  const _exhaustive: never = type;
  throw new Error(`Unknown discount type: ${_exhaustive}`);
}

