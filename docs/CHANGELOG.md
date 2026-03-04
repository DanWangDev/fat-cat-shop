# Changelog — Fat Cat Shop

All notable changes to this project are documented here, grouped by release phase.

---

## Testing Feedback Fixes (2026-02-19) — `feat/test-feedback`

Addresses 9 items from real-world testing feedback after Tier 3 completion. Two rounds of fixes.

### Round 1 — Fixes 1–9 + Product Image Upload

**Batch A — Quick fixes (no schema changes):**

| # | Fix | Files Changed |
|---|-----|---------------|
| 1 | Admin panel name reads `shop_name` from site settings instead of hardcoded "Fat Cat Admin" | `sidebar.tsx`, `admin-layout-client.tsx`, `admin layout.tsx` |
| 2 | Product creation shows human-readable validation errors (nullable description/tags, Zod error formatting) | `validators.ts`, `product-form.tsx`, product API routes |
| 3 | Favicon upload accepts ICO, SVG, and larger files | `upload/route.ts`, admin settings page |
| 4 | Phone field optional at checkout (email remains required) | `validators.ts`, checkout page |
| 5 | Stripe payment option greyed out with "Coming soon" badge | checkout page |
| 6 | Email shop owner on new order (`sendOwnerNewOrder`) | `email.ts`, `email-templates.ts`, checkout API, settings page |

**Batch B — Medium changes:**

| # | Fix | Files Changed |
|---|-----|---------------|
| 7 | Default shipping address in admin settings; public settings API (`/api/public/settings`); collapsible pre-filled checkout address | `site-settings.ts`, new `public/settings/route.ts`, checkout page, admin settings |
| 8 | Recommendation codes — schema, generation at checkout, validation API, checkout/success UI, admin toggle | `schema.ts`, `checkout/route.ts`, new `validate-recommendation/route.ts`, checkout + success pages |

**Batch C — Complex (schema + full UI):**

| # | Fix | Files Changed |
|---|-----|---------------|
| 9 | Product variants (multi-axis colour × size) — new schema tables, admin variant builder, storefront PDP selectors, cart/checkout integration | `schema.ts`, `product-form.tsx`, `product-variant-selector.tsx` (new), PDP page, `cart-store.ts`, checkout API |

**Additional:**
- Product image upload in admin form (multi-file upload, reorder, alt text, thumbnail grid)
- Suspense boundary fix for checkout success page

**Schema migrations:** `0004_absent_dark_beast.sql` (recommendation codes), `0005_stiff_bastion.sql` (product variants)

### Round 2 — Polish

- **Favicon serving:** Added ICO/SVG MIME types to uploads server; injected dynamic `<link rel="icon">` in root layout
- **Order status transitions:** Expanded `VALID_STATUS_TRANSITIONS` so admins can skip intermediate states (e.g. jump to delivered)
- **Payment status:** Replaced toggle button with unpaid/paid/refunded `<select>` dropdown
- **Product delete:** Added `DeleteProductButton` to product edit page header for discoverability

---

## Tier 3 — Major Features (2026-02-19) — PR #2

Five larger features adding email, analytics, stock management, cross-sell, and discount codes.

### Feature 8 — Transactional Emails (Resend)
- Order confirmation email on checkout (fire-and-forget)
- Shipped notification email when admin marks order as shipped
- Graceful no-op when `RESEND_API_KEY` is absent

### Feature 9 — Analytics Pipeline + Dashboard Sparklines
- Page-view event tracking via `/api/track` with visitor cookie
- `<AnalyticsTracker>` client component in storefront layout
- Daily aggregation (`aggregateToday()`) on admin dashboard load
- SVG sparklines on Revenue and Orders stat cards

### Feature 10 — Stock Levels + "Only N Left"
- Nullable `stock` column on products (`null` = unlimited)
- Admin product form: optional stock quantity input
- Storefront PDP: "Only N left" amber badge, "Out of stock" red badge, disabled Add to Cart
- Checkout: stock validation + atomic decrement on purchase

### Feature 11 — Cart Cross-Sell ("Customers also bought")
- Co-occurrence query on `orderLineItems` — top 4 related products
- `<CartCrossSell>` client component with debounced fetch
- Horizontal scroll row below cart items

### Feature 12 — Discount Codes
- `discountCodes` + `discountCodeUses` schema tables
- Admin CRUD pages (`/admin/discounts`) with sidebar nav link
- Validation API (`/api/validate-discount`) — checks active, expiry, per-customer limit
- Checkout integration: apply code, compute discount, decrement usage
- Supports percentage and fixed-amount discounts

**Schema migrations:** `0002` (analytics + stock), `0003` (discount codes)

---

## Theme System (2026-02-18) — PR #1

- Dynamic runtime theming with CSS variable switching
- 5 presets: manga (default), comic, pastel, neon, minimal
- Admin theme selector with live preview
- Hot-reload polling (2s interval) for real-time theme changes
- Google Fonts integration per preset
- `build-css-vars.ts` converts preset + custom overrides to inline styles

---

## UI/UX Improvements — Tiers 1 & 2 (2026-02-19) — PR #2

Comprehensive storefront and admin polish merged alongside Tier 3.

---

## Infrastructure & Deployment Fixes (2026-02-15 – 2026-02-17)

- Docker standalone build with `output: 'standalone'`
- Removed Caddy service for Synology NAS compatibility
- SQLite `busy_timeout` to prevent `SQLITE_BUSY` during build
- Lazy-init database connection via Proxy to avoid build lock contention
- WAL mode + lock file cleanup in Docker entrypoint
- Upload rewrite: `/uploads/:path*` → `/api/uploads/:path*` via `next.config.ts`
- Secure cookie logic respects `NEXT_PUBLIC_SITE_URL` protocol
- Layout cache invalidation on settings update
- Force-dynamic on storefront pages for fresh data
- Currency switched from USD to GBP
- Dev server port set to 7000

---

## MVP + Enhanced Admin (2026-02-14 – 2026-02-15)

### Initial MVP (2026-02-14)
- Storefront: homepage, product list, product detail, cart, checkout, order confirmation
- Admin: dashboard, product CRUD, order list/detail
- SQLite + Drizzle ORM schema (products, categories, customers, orders, line items)
- Tailwind CSS v4 styling with claymorphism design
- Zustand cart with localStorage persistence

### Enhanced Admin (2026-02-15)
- Multi-admin authentication with scrypt password hashing + HMAC cookies
- Category CRUD with inline create/edit and delete protection
- Enhanced dashboard with stat cards and kanban-lite order columns
- Customer management with order history and email deduplication
- Order tracking page (`/orders/track`) for customers
- Returning customer auto-fill at checkout
- Order status flow with visual timeline and status history audit log
- Admin site settings (key-value store)
