"use client";

import { useState } from "react";
import { useCartStore } from "@/stores/cart-store";
import { formatPrice } from "@/lib/utils";

interface OptionValue {
  id: string;
  label: string;
  colorHex: string | null;
}

interface OptionType {
  id: string;
  name: string;
  values: OptionValue[];
}

interface Variant {
  id: string;
  priceOverride: number | null;
  stock: number | null;
  imageUrl: string | null;
  combinationValueIds: string[];
}

interface ProductVariantSelectorProps {
  product: {
    id: string;
    title: string;
    price: number;
    image: string | null;
  };
  variantData: {
    optionTypes: OptionType[];
    variants: Variant[];
  };
}

export function ProductVariantSelector({ product, variantData }: ProductVariantSelectorProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function selectOption(optionTypeId: string, valueId: string) {
    setSelections((prev) => ({ ...prev, [optionTypeId]: valueId }));
  }

  // Find the matching variant based on current selections
  const allSelected = variantData.optionTypes.every((ot) => selections[ot.id]);
  const selectedValueIds = Object.values(selections);

  const matchedVariant = allSelected
    ? variantData.variants.find((v) => {
        if (v.combinationValueIds.length !== selectedValueIds.length) return false;
        return selectedValueIds.every((id) => v.combinationValueIds.includes(id));
      })
    : null;

  const displayPrice = matchedVariant?.priceOverride ?? product.price;
  const displayImage = matchedVariant?.imageUrl ?? product.image;
  const variantStock = matchedVariant?.stock;
  const isOutOfStock = matchedVariant ? variantStock === 0 : false;
  const isLowStock = matchedVariant ? (variantStock !== null && variantStock !== undefined && variantStock > 0 && variantStock <= 5) : false;

  // Build variant label for cart
  const variantLabel = allSelected
    ? variantData.optionTypes
        .map((ot) => {
          const val = ot.values.find((v) => v.id === selections[ot.id]);
          return val ? `${ot.name}: ${val.label}` : "";
        })
        .filter(Boolean)
        .join(" / ")
    : "";

  function handleAdd() {
    if (!allSelected || !matchedVariant) return;
    addItem(
      {
        productId: product.id,
        title: product.title,
        price: displayPrice,
        image: displayImage,
        variantId: matchedVariant.id,
        variantLabel,
      },
      qty,
    );

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "add_to_cart",
        path: window.location.pathname,
        metadata: { productId: product.id, title: product.title, price: displayPrice, quantity: qty, variantId: matchedVariant.id },
      }),
    }).catch(() => {});

    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setQty(1);
    }, 1500);
  }

  return (
    <div className="space-y-4">
      {/* Price display */}
      <div className="flex items-center gap-3">
        <span className="border-3 border-comic-ink bg-comic-yellow px-3 py-1 text-3xl font-bold text-comic-on-accent shadow-comic-sm">
          {formatPrice(displayPrice)}
        </span>
      </div>

      {/* Stock badges */}
      {isLowStock && (
        <span className="inline-block border-2 border-amber-500 bg-amber-50 px-2 py-0.5 text-sm font-bold text-amber-700">
          Only {variantStock} left!
        </span>
      )}
      {isOutOfStock && (
        <span className="inline-block border-2 border-comic-red bg-red-50 px-2 py-0.5 text-sm font-bold text-comic-red">
          Out of stock
        </span>
      )}

      {/* Option selectors */}
      {variantData.optionTypes.map((ot) => (
        <div key={ot.id}>
          <p className="mb-2 text-sm font-bold text-comic-ink/70">{ot.name}</p>
          <div className="flex flex-wrap gap-2">
            {ot.values.map((val) => {
              const isSelected = selections[ot.id] === val.id;
              const isColor = !!val.colorHex;

              if (isColor) {
                return (
                  <button
                    key={val.id}
                    type="button"
                    onClick={() => selectOption(ot.id, val.id)}
                    title={val.label}
                    className={`h-10 w-10 cursor-pointer border-3 transition-all ${
                      isSelected
                        ? "border-comic-ink shadow-comic-sm scale-110"
                        : "border-comic-ink/30 hover:border-comic-ink/60"
                    }`}
                    style={{ backgroundColor: val.colorHex! }}
                  />
                );
              }

              return (
                <button
                  key={val.id}
                  type="button"
                  onClick={() => selectOption(ot.id, val.id)}
                  className={`cursor-pointer border-3 px-4 py-2 text-sm font-bold transition-all ${
                    isSelected
                      ? "border-comic-ink bg-comic-ink text-white shadow-comic-sm"
                      : "border-comic-ink bg-comic-panel text-comic-ink hover:bg-comic-light-gray"
                  }`}
                >
                  {val.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Quantity + Add to Cart */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1 || added || !allSelected || isOutOfStock}
            aria-label="Decrease quantity"
            className="flex h-10 w-10 items-center justify-center border-3 border-comic-ink bg-comic-panel font-bold text-comic-ink hover:bg-comic-light-gray disabled:opacity-50"
          >
            -
          </button>
          <span className="flex h-10 w-12 items-center justify-center border-y-3 border-comic-ink bg-comic-panel text-center font-bold text-comic-ink">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            disabled={qty >= 99 || added || !allSelected || isOutOfStock}
            aria-label="Increase quantity"
            className="flex h-10 w-10 items-center justify-center border-3 border-comic-ink bg-comic-panel font-bold text-comic-ink hover:bg-comic-light-gray disabled:opacity-50"
          >
            +
          </button>
        </div>

        <button
          onClick={handleAdd}
          disabled={added || !allSelected || isOutOfStock}
          className="min-h-[44px] w-full cursor-pointer border-3 border-comic-ink bg-comic-red px-6 py-3 font-display text-base font-bold text-comic-on-primary shadow-comic transition-all duration-200 ease-out hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-comic-pressed disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-70 disabled:shadow-comic-pressed"
        >
          {added
            ? "Added!"
            : isOutOfStock
              ? "Out of Stock"
              : !allSelected
                ? "Select Options"
                : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
