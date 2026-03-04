# Testing Feedback Implementation Plan — Fat Cat Shop

> **Status: COMPLETE** — All 9 fixes implemented across two commits on `feat/test-feedback` (2026-02-19). See `docs/CHANGELOG.md` for summary.

## Context

Tier 3 is complete. These changes address 11 items from real testing feedback: branding consistency, UX polish, email gaps, a product variant system, and a new recommendation-code referral feature. Organised into three batches by risk; schema-heavy work is last.

---

## Batch A — Quick fixes (no schema changes)

### Fix 1 — Admin panel name is always "Fat Cat Admin"

**Root cause:** `src/components/admin/sidebar.tsx:121` and `src/components/admin/admin-layout-client.tsx:37-38` hardcode the string.

**Fix:**
- `src/app/admin/(dashboard)/layout.tsx` — already a server component; call `getSiteSettings()` and pass `settings.shop_name` as a prop down to `AdminLayoutClient`
- `src/components/admin/admin-layout-client.tsx` — accept `shopName: string` prop; pass it to `AdminSidebar`
- `src/components/admin/sidebar.tsx` — accept `shopName: string` prop; render `{shopName} Admin` instead of hardcoded string

---

### Fix 2 — Confusing validation error when adding products

**Root cause (two issues):**
1. `src/components/admin/product-form.tsx` sends `description: null` and `tags: null` when fields are empty, but `productSchema` uses `.optional()` (accepts `undefined`) not `.nullable()` — Zod rejects `null`.
2. API routes return `{ error: err.message }` for ZodErrors, which serialises as the raw Zod JSON.

**Fix:**
- `src/lib/validators.ts` — change `description` and `tags` to `z.string().nullable().optional()`
- `src/app/api/admin/products/route.ts` and `src/app/api/admin/products/[id]/route.ts` — add `if (err instanceof z.ZodError)` branch returning `{ error: "Validation failed", details: err.issues }` with status 400
- `src/components/admin/product-form.tsx` — when the response has `details`, show the first human-readable issue message (e.g. `details[0].message`)

---

### Fix 3 — Favicon: allow larger files / more formats

**Current:** UI says "32×32 or 64×64 PNG"; code already allows 10 MB but only JPEG/PNG/WebP/GIF.

**Fix:**
- `src/app/api/upload/route.ts` — add `image/x-icon`, `image/vnd.microsoft.icon`, `image/svg+xml` to allowed MIME types
- `src/app/admin/(dashboard)/settings/page.tsx` — update helper text to "PNG, SVG, or ICO — any size"

---

### Fix 4 — Phone optional, email mandatory at checkout

**Fix:**
- `src/lib/validators.ts` — change `phone: z.string().min(1, "Phone number is required")` → `phone: z.string().optional()`
- `src/app/(storefront)/checkout/page.tsx` — remove `required` from the phone `InputField`, update label to "Phone / WhatsApp (optional)"
- `src/app/api/checkout/route.ts` — no change needed (phone already nullable in DB)

---

### Fix 5 — Grey out Stripe card payment

**Fix:**
- `src/app/(storefront)/checkout/page.tsx` — disable the Stripe radio button (`disabled`), add `opacity-50 cursor-not-allowed` styling, append a "Coming soon" badge. If form state is somehow `"stripe"`, reset to `"cod"` on mount.

---

### Fix 6 — Email shop owner on new order

**New email:** `sendOwnerNewOrder()` — fires when any order is created.

**New files/changes:**
- `src/lib/email-templates.ts` — add `ownerNewOrderHtml({ orderNumber, customerName, email, total, items })` template
- `src/lib/email.ts` — add `sendOwnerNewOrder()` function; recipient = `process.env.OWNER_EMAIL ?? "grace.by.wang@gmail.com"`
- `src/app/api/checkout/route.ts` — fire-and-forget `sendOwnerNewOrder(...)` alongside existing `sendOrderConfirmation`
- `.env.example` — add `OWNER_EMAIL=grace.by.wang@gmail.com`
- `src/lib/site-settings.ts` — add `owner_email` to `SiteSettingsMap` (default `"grace.by.wang@gmail.com"`) so it's editable in admin Settings
- `src/app/admin/(dashboard)/settings/page.tsx` — add "Owner notification email" field

*Note: Email customer when order is shipped is **already implemented** in Tier 3 (`sendOrderShipped` called in `src/app/api/admin/orders/[id]/status/route.ts`).*

*Note: Discount codes are **already implemented** in Tier 3 (admin CRUD + checkout input).*

---

## Batch B — Medium changes

### Fix 7 — Default shipping address in Settings + collapsible checkout address

**Part A — Settings:**
- `src/lib/site-settings.ts` — add `default_address: string` to `SiteSettingsMap`; default value:
  ```json
  {"addressLine1":"Brook Grn","city":"London","postalCode":"W6 7BS","country":"United Kingdom"}
  ```
- `src/app/api/admin/settings/route.ts` — add `default_address` to the allowed-keys whitelist
- `src/app/admin/(dashboard)/settings/page.tsx` — add four individual inputs (Address Line 1, City, Postcode, Country) that read/write the `default_address` JSON key as a group

**Part B — Public endpoint:**
- `src/app/api/public/settings/route.ts` *(new, no auth)* — `GET` returns only safe public keys: `{ shopName, defaultAddress }`. Checkout page fetches this on mount.

**Part C — Checkout UI:**
- `src/app/(storefront)/checkout/page.tsx`:
  - On mount, fetch `/api/public/settings`; pre-populate address fields from `defaultAddress`
  - Wrap the Shipping Address panel in a collapsible `<details>`/custom accordion — **collapsed by default**, shows a one-line summary (e.g. "Brook Grn, London W6 7BS — click to change")
  - Address validation still runs on submit; the pre-populated values mean it passes unless the user blanked a required field

---

### Fix 8 — Recommendation codes

**Concept:** At order completion, generate a unique shareable code for the customer. First-time buyers can enter it at checkout (tracking only for now — no discount). Admin can toggle the feature on/off.

**Schema changes (`src/lib/db/schema.ts`):**

```typescript
recommendationCodes: {
  id: text PK
  code: text UNIQUE NOT NULL          // e.g. "WANG-A3X9"
  customerId: text FK → customers (cascade)
  orderId: text FK → orders           // the order that generated it
  usedCount: integer default 0
  createdAt: text
}

recommendationCodeUses: {
  id: text PK
  codeId: text FK → recommendationCodes (cascade)
  usedByCustomerId: text FK → customers
  orderId: text FK → orders           // the new first-timer's order
  usedAt: text
}
```

Add to `orders`: `recommendationCode: text nullable` (the code the customer used when placing this order).

**Site setting:** Add `enable_recommendation_codes: string` (`"true"` / `"false"`) to `SiteSettingsMap`; default `"false"`. Surface as a toggle in admin Settings.

**Code generation:** `FC-{4 random alphanumeric uppercase}` (e.g. `FC-A3X9`). Generates at checkout after order insert, only when setting is `"true"`.

**New / changed files:**
- `src/lib/db/schema.ts` — add tables + `recommendationCode` column on orders
- Run `pnpm db:generate && pnpm db:migrate`
- `src/app/api/checkout/route.ts` — if `enable_recommendation_codes === "true"`, generate & insert code after order succeeds; include code in the confirmation email to customer
- `src/lib/email-templates.ts` — update `orderConfirmationHtml` to accept optional `recommendationCode` and display it with sharing copy
- `src/app/api/validate-recommendation/route.ts` *(new)* — `GET ?code=X&email=E`:
  - Look up code; check customer with that email has zero previous completed orders → return `{ valid: true, code }` or `{ valid: false, error }`
- `src/app/(storefront)/checkout/page.tsx` — if public settings say feature is enabled, show a "Recommendation Code" input above the discount code section; on Apply, call `/api/validate-recommendation`; pass `recommendationCode` in POST body (stored on order, no price change)
- `src/app/(storefront)/checkout/success/page.tsx` — show the customer's new recommendation code (fetch from `/api/orders/{orderNumber}/rec-code` or embed in query param) with copy-to-clipboard button
- `src/lib/validators.ts` — add `recommendationCode: z.string().optional()` to `checkoutSchema`
- Admin Settings page — add enable/disable toggle for recommendation codes

---

## Batch C — Complex (schema + full UI)

### Fix 9 — Product variants (multi-axis: colour × size)

**Schema changes (`src/lib/db/schema.ts`):**

```typescript
productOptionTypes: {
  id: text PK
  productId: text FK → products (cascade)
  name: text NOT NULL     // "Color", "Size"
  sortOrder: integer default 0
}

productOptionValues: {
  id: text PK
  optionTypeId: text FK → productOptionTypes (cascade)
  label: text NOT NULL    // "Blue", "Small"
  colorHex: text          // optional, for colour swatches
  sortOrder: integer default 0
}

productVariants: {
  id: text PK
  productId: text FK → products (cascade)
  sku: text               // optional
  priceOverride: integer  // nullable — falls back to product.price
  stock: integer          // nullable — falls back to product.stock
  imageUrl: text          // nullable — variant-specific image
  createdAt: text
  updatedAt: text
}

productVariantCombinations: {
  id: text PK
  variantId: text FK → productVariants (cascade)
  optionValueId: text FK → productOptionValues (cascade)
}
```

Run `pnpm db:generate && pnpm db:migrate`.

**Admin product form (`src/components/admin/product-form.tsx`):**
- Add a "Variants" section below tags:
  - "Option types" builder — add a named axis ("Color", "Size") then add values with optional hex picker
  - "Variant table" auto-generated from the cartesian product of all option values; each row shows the combination label and editable price override / stock / image URL fields
  - Save sends `{ ...product, optionTypes: [...], variants: [...] }` to the API

**Admin API (`src/app/api/admin/products/route.ts` + `[id]/route.ts`):**
- Extend Zod schema with `optionTypes` + `variants` arrays
- POST/PUT: upsert option types → values → variants → combinations inside a transaction-style sequential insert

**Storefront PDP (`src/app/(storefront)/products/[slug]/page.tsx`):**
- Fetch product with `optionTypes`, `optionValues`, and `variants` via Drizzle relational query
- If variants exist, render option selectors (colour swatches for hex values, button group for others)
- On selection, find the matching `productVariant` and update displayed price, stock badge, and image
- Pass `variantId` to `AddToCartButton`; include in cart item

**Cart / checkout:**
- `src/stores/cart-store.ts` — add optional `variantId` and `variantLabel` to cart item type
- `src/app/api/checkout/route.ts` — if `variantId` present, validate stock against `productVariants.stock` (not `products.stock`); decrement variant stock

**Validators (`src/lib/validators.ts`):**
```typescript
export const productOptionValueSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  colorHex: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const productOptionTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
  values: z.array(productOptionValueSchema),
})

export const productVariantSchema = z.object({
  id: z.string().optional(),
  combinationIds: z.array(z.string()),  // optionValueId list
  sku: z.string().optional(),
  priceOverride: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  imageUrl: z.string().optional(),
})
```

---

## Implementation Order

| Batch | Items | Parallelisable? |
|-------|-------|-----------------|
| A | Fixes 1–6 (admin name, errors, favicon, phone, stripe, owner email) | All independent — yes |
| B | Fix 7 (default address) → Fix 8 (rec codes) | 7 first (adds public settings endpoint used by checkout), then 8 |
| C | Fix 9 (variants) | Sequential — touches schema, API, form, PDP |

---

## Key File Reference

| File | Touched by |
|------|-----------|
| `src/lib/site-settings.ts` | Fixes 1, 6, 7, 8 |
| `src/lib/validators.ts` | Fixes 2, 4, 8, 9 |
| `src/lib/db/schema.ts` | Fixes 8, 9 |
| `src/lib/email.ts` | Fix 6 |
| `src/lib/email-templates.ts` | Fixes 6, 8 |
| `src/components/admin/sidebar.tsx` | Fix 1 |
| `src/components/admin/admin-layout-client.tsx` | Fix 1 |
| `src/app/admin/(dashboard)/layout.tsx` | Fix 1 |
| `src/app/admin/(dashboard)/settings/page.tsx` | Fixes 3, 6, 7, 8 |
| `src/app/api/admin/settings/route.ts` | Fixes 6, 7, 8 |
| `src/app/api/admin/products/route.ts` | Fix 2, 9 |
| `src/app/api/admin/products/[id]/route.ts` | Fix 2, 9 |
| `src/app/api/checkout/route.ts` | Fixes 4, 6, 8, 9 |
| `src/app/api/upload/route.ts` | Fix 3 |
| `src/app/api/public/settings/route.ts` *(new)* | Fix 7 |
| `src/app/api/validate-recommendation/route.ts` *(new)* | Fix 8 |
| `src/app/(storefront)/checkout/page.tsx` | Fixes 4, 5, 7, 8 |
| `src/app/(storefront)/checkout/success/page.tsx` | Fix 8 |
| `src/app/(storefront)/products/[slug]/page.tsx` | Fix 9 |
| `src/components/admin/product-form.tsx` | Fixes 2, 9 |
| `src/components/storefront/add-to-cart-button.tsx` | Fix 9 |
| `src/stores/cart-store.ts` | Fix 9 |

---

## Verification

- **Fix 1:** Change shop name in admin Settings → refresh admin sidebar — name updates
- **Fix 2:** Create product with empty tags/description — friendly error shown; fill required fields — saves correctly
- **Fix 3:** Upload a `.ico` or `.svg` favicon — accepted; upload a large PNG — accepted
- **Fix 4:** Checkout without phone — order completes; without email — validation error shown
- **Fix 5:** Stripe radio is greyed, unclickable, shows "Coming soon"
- **Fix 6:** Place test order → `grace.by.wang@gmail.com` receives new-order email
- **Fix 7:** Set default address in Settings → open checkout — address pre-filled; section collapsed; expand — can edit freely
- **Fix 8:** Place order with feature enabled → success page shows rec code; second customer (first-time) enters it → accepted; returning customer enters it → rejected; admin disables feature → input hidden
- **Fix 9:** Add color + size options to a product; storefront PDP shows swatches and size buttons; selecting Blue/Large updates price & stock; add to cart; checkout decrements variant stock
