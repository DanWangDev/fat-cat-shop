"use client";

import { useCartStore } from "@/stores/cart-store";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CartCrossSell } from "@/components/storefront/cart-cross-sell";

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-comic-ink">
          Your Cart
        </h1>
        <div className="mt-8 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse border-3 border-comic-ink/20 bg-comic-light-gray" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-comic-ink">
          Your Cart
        </h1>
        <div className="mt-12 text-center">
          <p className="font-bold text-comic-ink/60">Your cart is empty.</p>
          <Link
            href="/products"
            className="mt-6 inline-block min-h-[44px] cursor-pointer border-3 border-comic-ink bg-comic-red px-8 py-3 font-display text-base font-bold text-comic-on-primary shadow-comic transition-all duration-200 ease-out hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-comic-ink">
        Your Cart
      </h1>

      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <div
            key={`${item.productId}-${item.variantId ?? ""}`}
            className="border-3 border-comic-ink bg-comic-panel p-4 shadow-comic"
          >
            {/* Mobile: stacked layout / Desktop: horizontal */}
            <div className="flex gap-4">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden border-2 border-comic-ink bg-comic-light-gray">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-comic-ink/20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-comic-ink">
                    {item.title}
                  </h3>
                  {/* Remove button - visible on all sizes */}
                  <button
                    onClick={() => removeItem(item.productId, item.variantId)}
                    className="flex min-h-[44px] min-w-[44px] flex-shrink-0 cursor-pointer items-center justify-center text-comic-ink/40 transition-colors duration-200 hover:text-comic-red"
                    aria-label={`Remove ${item.title} from cart`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                {item.variantLabel && (
                  <p className="text-xs font-bold text-comic-ink/50">
                    {item.variantLabel}
                  </p>
                )}
                <p className="mt-1 text-sm font-bold text-comic-red">
                  {formatPrice(item.price)}
                </p>
              </div>
            </div>

            {/* Bottom row: quantity controls + line total */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateQuantity(item.productId, item.quantity - 1, item.variantId)
                  }
                  className="flex h-9 w-9 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-2 border-comic-ink font-bold text-comic-ink transition-all duration-200 hover:bg-comic-red/10 active:bg-comic-red/20"
                  aria-label={`Decrease quantity of ${item.title}`}
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-bold">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    updateQuantity(item.productId, item.quantity + 1, item.variantId)
                  }
                  className="flex h-9 w-9 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-2 border-comic-ink font-bold text-comic-ink transition-all duration-200 hover:bg-comic-red/10 active:bg-comic-red/20"
                  aria-label={`Increase quantity of ${item.title}`}
                >
                  +
                </button>
              </div>
              <div className="text-sm font-bold text-comic-ink">
                {formatPrice(item.price * item.quantity)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 border-3 border-comic-ink bg-comic-panel p-6 shadow-comic">
        <div className="flex items-center justify-between text-lg font-bold text-comic-ink">
          <span>Total</span>
          <span className="border-2 border-comic-ink bg-comic-yellow px-3 py-1 text-comic-on-accent">{formatPrice(totalPrice())}</span>
        </div>
        <Link
          href="/checkout"
          className="mt-6 block min-h-[44px] w-full cursor-pointer border-3 border-comic-ink bg-comic-red py-3 text-center font-display text-base font-bold text-comic-on-primary shadow-comic transition-all duration-200 ease-out hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-comic-pressed"
        >
          Proceed to Checkout
        </Link>
        <Link
          href="/products"
          className="mt-3 block cursor-pointer text-center text-sm font-bold text-comic-ink/60 transition-colors duration-200 hover:text-comic-red"
        >
          Continue Shopping
        </Link>
      </div>

      <CartCrossSell />
    </div>
  );
}
