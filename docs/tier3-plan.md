# Tier 3 Implementation Plan — Fat Cat Shop

> **Status: COMPLETE** — All 5 features (emails, analytics, stock, cross-sell, discount codes) merged in PR #2 (2026-02-19). See `docs/CHANGELOG.md` for summary.

## Context

Tiers 1 and 2 are complete and pushed (`feat/ui-ux-improvements`). Tier 3 adds five larger features requiring new packages, schema migrations, or both. Implement in the order shown — Batch A and B can be parallelised within each batch; Batch C is sequential.

---

## Feature 8 — Transactional Emails (Resend)

**Why:** Customers receive zero feedback after placing an order. Confirmation + shipped emails are table-stakes for any shop.

### Install
```
pnpm add resend
```

### New files
- `src/lib/email.ts` — Resend client + `sendOrderConfirmation()` + `sendOrderShipped()`
- `src/lib/email-templates.ts` — plain HTML template strings (no React Email needed)

### Modified files
- `src/app/api/checkout/route.ts` — call `sendOrderConfirmation()` after order insert (fire-and-forget)
- `src/app/api/admin/orders/[id]/status/route.ts` — call `sendOrderShipped()` when `toStatus === "shipped"`
- `.env.example` — add `RESEND_API_KEY=` and `EMAIL_FROM=noreply@yourdomain.com`

### Key implementation notes
- If `RESEND_API_KEY` is absent: log warning, return silently (dev no-op)
- Send fire-and-forget: `sendOrderConfirmation(...).catch(console.error)` — never block the response
- Order confirmation email: order number, item list with quantities + prices, total
- Shipped email: order number, "your order is on its way" message

### Verification
Set `RESEND_API_KEY` in `.env.local` → place test order → check inbox; transition order to "shipped" in admin → check inbox.

---

## Feature 9 — Analytics Pipeline + Dashboard Sparklines

**Why:** `analyticsDailySummary` and `analyticsEvents` tables exist but are empty — no tracking code exists. Full pipeline needed before UI has any data.

### Sub-feature A: Page-view event tracking

**New files:**
- `src/app/api/track/route.ts` — `POST { event, path }`: reads/sets `visitor_id` cookie (30-day), inserts into `analyticsEvents`; returns 200; no auth required
- `src/components/storefront/analytics-tracker.tsx` — `"use client"` component; fires `fetch("/api/track", { method:"POST", body:JSON.stringify({ event:"pageview", path:pathname }) })` in `useEffect`; uses `usePathname()` from next/navigation

**Modified files:**
- `src/app/(storefront)/layout.tsx` — add `<AnalyticsTracker />` (client island in server layout)

### Sub-feature B: Daily aggregation

**New files:**
- `src/lib/analytics.ts` — `aggregateToday()`: COUNT DISTINCT visitorIds + pageViews from `analyticsEvents` WHERE date = today; COUNT orders + SUM revenue from `orders` WHERE date = today; upsert into `analyticsDailySummary`

**Modified files:**
- `src/app/admin/(dashboard)/page.tsx` — call `aggregateToday()` server-side on each dashboard load; then query last 30 rows from `analyticsDailySummary`

### Sub-feature C: Sparkline UI

**New files:**
- `src/components/admin/sparkline.tsx` — pure SVG `<polyline>` normalised to 80×24 viewBox; props: `data: number[]`, `color?: string`; no external chart library

**Modified files:**
- `src/app/admin/(dashboard)/page.tsx` — add `<Sparkline>` to Revenue and Orders stat cards

### Verification
Browse storefront pages → check `analyticsEvents` in Drizzle Studio → load admin dashboard → `analyticsDailySummary` gets today's row → sparklines render.

---

## Feature 10 — Stock Levels + "Only N Left"

**Why:** The shop can currently oversell without limit. Nullable stock column keeps unlimited-stock products working unchanged (`null` = unlimited).

### Schema changes
`src/lib/db/schema.ts` — add to `products` table:
```typescript
stock: integer("stock"),  // nullable — null means unlimited
```
Run `pnpm db:generate && pnpm db:migrate`.

### Admin changes
- `src/components/admin/product-form.tsx` — add optional "Stock quantity" number input (empty = unlimited)
- `src/lib/validators.ts` — add `stock: z.number().int().min(0).nullable().optional()` to `productSchema`
- `src/app/api/admin/products/[id]/route.ts` — include `stock` in PUT handler
- `src/app/admin/(dashboard)/products/page.tsx` — add Stock column (show number or "∞" when null)

### Storefront PDP changes (`src/app/(storefront)/products/[slug]/page.tsx`)
- `0 < stock <= 5` → amber "Only {N} left" badge beside price
- `stock === 0` → red "Out of stock" badge; pass `disabled` prop to `AddToCartButton`
- `src/components/storefront/add-to-cart-button.tsx` — accept optional `disabled?: boolean` prop

### Checkout (`src/app/api/checkout/route.ts`)
1. After fetching `dbProducts`, check `product.stock !== null && product.stock < item.quantity` → return 400 `"Not enough stock for {title}"`
2. After all inserts succeed, decrement stock atomically per line item:
   ```typescript
   db.update(products)
     .set({ stock: sql`stock - ${item.quantity}` })
     .where(eq(products.id, item.productId))
     .run();
   ```

### Verification
Set stock=2 → PDP shows "Only 2 left" → attempt checkout with qty 3 → 400 error; set stock=0 → Add to Cart disabled; successful checkout decrements DB stock.

---

## Feature 11 — Cart Cross-Sell ("Customers also bought")

**Why:** Co-occurrence query on existing `orderLineItems`; no schema changes. Works immediately once any order history exists.

### New files
- `src/app/api/cross-sell/route.ts` — `GET /api/cross-sell?ids=id1,id2`:
  Find orders containing the given product IDs, count frequency of other products in those same orders, return top 4 (active only, excluding input IDs).
  ```sql
  SELECT p.*, COUNT(*) as freq
  FROM order_line_items oli
  JOIN products p ON p.id = oli.product_id
  WHERE oli.order_id IN (
    SELECT DISTINCT order_id FROM order_line_items WHERE product_id IN (...)
  )
  AND oli.product_id NOT IN (...)
  AND p.status = 'active'
  GROUP BY oli.product_id
  ORDER BY freq DESC
  LIMIT 4
  ```
  Returns `{ products: { id, title, slug, price, compareAtPrice, image }[] }`

- `src/components/storefront/cart-cross-sell.tsx` — `"use client"` component:
  - Reads `useCartStore` for current product IDs
  - `useEffect` fetches `/api/cross-sell?ids=...` on cart change (300ms debounce)
  - Renders ≤4 `ProductCard`s in horizontal scroll row with heading "You might also like"
  - Renders nothing if cart empty or no results

### Modified files
- Cart page (`src/app/(storefront)/cart/page.tsx` or equivalent) — add `<CartCrossSell />` below cart items

### Verification
Place 2+ orders with overlapping products → visit cart with one of those products → cross-sell section appears.

---

## Feature 12 — Post-Purchase Discount Codes

**Why:** Highest retention value — generates repeat purchase incentive. Supports percentage off, fixed amount off, single-use per customer, and expiry dates.

### Schema changes
Add to `src/lib/db/schema.ts`:

```typescript
// New table
discountCodes: {
  id: text PK
  code: text UNIQUE NOT NULL
  type: text enum["percentage", "fixed"] NOT NULL
  value: integer NOT NULL  // basis points for %, e.g. 1000 = 10%; or cents for fixed
  maxUses: integer nullable       // null = unlimited global uses
  usedCount: integer default 0
  perCustomerLimit: integer default 1  // 1 = single-use per customer email
  expiresAt: text nullable             // ISO string
  active: integer boolean default true
  createdAt: text NOT NULL
  updatedAt: text NOT NULL
}

// New table
discountCodeUses: {
  id: text PK
  codeId: text FK → discountCodes (cascade delete)
  customerEmail: text NOT NULL
  orderId: text FK → orders (cascade delete)
  usedAt: text NOT NULL
}
```

Also add to `orders` table:
```typescript
discountCode: text nullable
discountAmount: integer default 0
```

Run `pnpm db:generate && pnpm db:migrate`.

### Admin management
- `src/app/admin/(dashboard)/discounts/page.tsx` — list codes (code, type, value, uses/max, expiry, active badge)
- `src/app/admin/(dashboard)/discounts/new/page.tsx` — creation form
- `src/app/api/admin/discounts/route.ts` — `GET` (list) + `POST` (create)
- `src/app/api/admin/discounts/[id]/route.ts` — `PATCH` (toggle active) + `DELETE`
- `src/components/admin/sidebar.tsx` — add "Discounts" nav link

### Discount validation endpoint
- `src/app/api/validate-discount/route.ts` — `GET ?code=X&subtotal=N&email=E`:
  - Look up code; check active, not expired, `usedCount < maxUses` (if set), per-customer use count
  - Return `{ valid: true, discountAmount: N }` or `{ valid: false, error: "..." }`

### Checkout integration (`src/app/api/checkout/route.ts`)
- Extend `checkoutRequestSchema` with `discountCode: z.string().optional()`
- Validate code → compute `discountAmount` (% of subtotal or fixed cents, capped at subtotal)
- `total = subtotal + shippingCost - discountAmount`
- After order insert: increment `usedCount`, insert `discountCodeUses` row
- Include `discountCode` and `discountAmount` in `orders` insert

### Storefront checkout form
- Add "Discount code" text input + "Apply" button
- On apply: `GET /api/validate-discount?code=X&subtotal=N&email=E` → show discount amount or error
- Pass applied code in checkout POST body

### `src/lib/validators.ts`
- Add `discountCode: z.string().optional()` to `checkoutSchema`

### Verification
Create 10%-off code (perCustomerLimit=1) → apply at checkout → total reduced → usedCount increments → retry same code/email → rejected; set expiry to past → rejected.

---

## Implementation Order

| Batch | Features | Can parallelise? |
|-------|----------|-----------------|
| **Batch A** | #8 Emails + #9 Analytics | ✅ Fully independent |
| **Batch B** | #10 Stock + #11 Cross-sell | ✅ Different files, no overlap |
| **Batch C** | #12 Discount codes | Sequential after #10 (both touch checkout + schema) |

## Key Reuse References
- `isAuthenticated()` — `src/lib/auth.ts`
- `nanoid()` — all new ID generation
- `z` from `"zod/v4"` — all Zod validation
- `db` from `@/lib/db` — all database access
- `formatPrice()` — `src/lib/utils.ts`
- `cn()` — `src/lib/utils.ts`
- `ProductCard` — `src/components/storefront/product-card.tsx`
- `checkoutSchema` — `src/lib/validators.ts` (extend, don't replace)
- `VALID_STATUS_TRANSITIONS` — `src/lib/utils.ts`
- Admin card style: `rounded-xl bg-white p-6 shadow-sm`
- Admin button style: `rounded-full bg-teal-primary px-6 py-2 text-sm font-bold text-white hover:bg-teal-dark`
- Admin link style: `rounded-lg px-3 py-1 text-sm text-teal-primary transition-colors hover:bg-teal-primary/10`
