"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  variantId?: string | null;
  variantLabel?: string | null;
  title: string;
  price: number;
  image: string | null;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) =>
        set((state) => {
          const matchKey = (i: CartItem) =>
            i.productId === item.productId && (i.variantId ?? null) === (item.variantId ?? null);
          const existing = state.items.find(matchKey);
          if (existing) {
            return {
              items: state.items.map((i) =>
                matchKey(i) ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),

      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && (i.variantId ?? null) === (variantId ?? null)),
          ),
        })),

      updateQuantity: (productId, quantity, variantId) =>
        set((state) => {
          const matchKey = (i: CartItem) =>
            i.productId === productId && (i.variantId ?? null) === (variantId ?? null);
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => !matchKey(i)),
            };
          }
          return {
            items: state.items.map((i) =>
              matchKey(i) ? { ...i, quantity } : i,
            ),
          };
        }),

      clearCart: () => set({ items: [] }),

      totalItems: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      totalPrice: () =>
        get().items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        ),
    }),
    {
      name: "fat-cat-cart",
    },
  ),
);
