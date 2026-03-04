"use client";

import { useCartStore } from "@/stores/cart-store";
import { useState } from "react";

interface AddToCartButtonProps {
  product: {
    id: string;
    title: string;
    price: number;
    image: string | null;
  };
  variantId?: string | null;
  variantLabel?: string | null;
  disabled?: boolean;
}

export function AddToCartButton({ product, variantId, variantLabel, disabled }: AddToCartButtonProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem({
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      variantId: variantId ?? null,
      variantLabel: variantLabel ?? null,
    }, qty);

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "add_to_cart",
        path: window.location.pathname,
        metadata: { productId: product.id, title: product.title, price: product.price, quantity: qty },
      }),
    }).catch(() => {});

    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setQty(1);
    }, 1500);
  }

  return (
    <div className="space-y-3">
      {/* Quantity stepper */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={qty <= 1 || added || !!disabled}
          aria-label="Decrease quantity"
          className="flex h-10 w-10 items-center justify-center border-3 border-comic-ink bg-comic-panel font-bold text-comic-ink hover:bg-comic-light-gray disabled:opacity-50"
        >
          −
        </button>
        <span className="flex h-10 w-12 items-center justify-center border-y-3 border-comic-ink bg-comic-panel text-center font-bold text-comic-ink">
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(99, q + 1))}
          disabled={qty >= 99 || added || !!disabled}
          aria-label="Increase quantity"
          className="flex h-10 w-10 items-center justify-center border-3 border-comic-ink bg-comic-panel font-bold text-comic-ink hover:bg-comic-light-gray disabled:opacity-50"
        >
          +
        </button>
      </div>

      {/* Add to cart button */}
      <button
        onClick={handleAdd}
        disabled={added || !!disabled}
        aria-label={added ? `${product.title} added to cart` : `Add ${product.title} to cart`}
        className="min-h-[44px] w-full cursor-pointer border-3 border-comic-ink bg-comic-red px-6 py-3 font-display text-base font-bold text-comic-on-primary shadow-comic transition-all duration-200 ease-out hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-comic-pressed disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-70 disabled:shadow-comic-pressed"
      >
        {added ? "Added!" : disabled ? "Out of Stock" : "Add to Cart"}
      </button>
    </div>
  );
}
