# Changelog — Fat Cat Shop

All notable changes to this project are documented here, grouped by release phase.

---

## Security Hardening (2026-03-08) — `feat/security-hardening`

Comprehensive security hardening addressing 18+ vulnerabilities across auth, input validation, headers, and application logic.

### Phase 1 — Auth & Session Hardening
- Removed hardcoded credential defaults; `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` now required via `requireEnv()`
- Removed legacy `{ user: "admin" }` backward-compat session support
- Cookie: `sameSite: "strict"`, `maxAge` reduced from 7 days to 1 day, simplified `secure` flag

### Phase 2 — Rate Limiting
- **New:** `src/lib/rate-limit.ts` — in-memory sliding window with periodic cleanup
- Login: 5 attempts / 15 min per IP; Checkout: 10 req / min; Customer lookup: 10 req / min
- Returns 429 with `Retry-After` header

### Phase 3 — Security Headers, CSRF & Admin Gate
- Security headers via `next.config.ts`: X-Frame-Options DENY, CSP, HSTS, nosniff, Permissions-Policy, Referrer-Policy
- **New:** `src/middleware.ts` — CSRF origin validation on API mutations + `ADMIN_ACCESS_TOKEN` gate (returns 404 on unauthorized)
- **New:** `public/robots.txt` — Disallow `/admin/`

### Phase 4 — Input Validation Hardening
- Added `.max()` constraints to all unbounded string fields in `validators.ts`
- `colorHex`: regex-validated hex; `slug`: lowercase alphanumeric with hyphens; `imageUrl`: URL validation
- Login route: replaced manual checks with Zod schema
- Password strength: min 8 chars + uppercase + lowercase + digit

### Phase 5 — Information Disclosure Fixes
- Checkout errors no longer leak product/variant IDs
- Checkout catch-all and AI theme generate return generic error messages

### Phase 6 — Theme Hot-Reload Security
- `postMessage` origin check; whitelist `--` prefixed CSS properties; skip values > 200 chars

### Phase 7 — Checkout Hardening
- `crypto.randomInt()` replaces `Math.random()` for recommendation codes and order numbers
- Recommendation code length increased from 4 to 6 characters
- Stock decrement guarded with `WHERE stock >= quantity` to prevent negative stock
- Order tracking: `JSON.parse` wrapped in try-catch

---

## Analytics Enhancement (2026-03-04) — `feat/test-feedback`

Comprehensive analytics dashboard with 6 report sections, conversion funnel tracking, and enriched event collection.

### Phase 1 — Schema & Event Enrichment

**Schema migration:** `0006_cultured_skrulls.sql`
- Added `metadata` text column (nullable JSON) to `analytics_events`
- Added 4 indexes on `analytics_events` + 2 indexes on `orders`

**Event tracking:**
- `/api/track` accepts optional `metadata` object
- New events: `product_view`, `add_to_cart`, `checkout_started`, `purchase`

| Event | Trigger | Metadata |
|-------|---------|----------|
| `pageview` | Every storefront route change | — |
| `product_view` | Product detail page | `{ slug }` |
| `add_to_cart` | Add to cart click | `{ productId, title, price, quantity }` |
| `checkout_started` | Checkout page mount (with items) | `{ itemCount, subtotal }` |
| `purchase` | Successful order submission | `{ orderNumber, total }` |

### Phase 2 — Query Library

New `src/lib/analytics-queries.ts` with 6 query functions:
- `getTrafficStats()` — visitors, pageviews, top pages, referrer breakdown, daily series
- `getFunnelStats()` — 5-stage conversion funnel (visit → product view → cart → checkout → purchase)
- `getProductStats()` — best sellers, revenue by category
- `getCustomerStats()` — new/repeat customers, repeat rate, top customers, geography
- `getCampaignStats()` — discount code ROI, recommendation code viral loop
- `getRevenueStats()` — revenue, AOV, daily series, payment method breakdown

### Phase 3 — Analytics Page & UI Components

**New page:** `/admin/analytics` with date range tabs (7D / 30D / 90D)

**New shared components** (`src/components/admin/analytics/`):
- `stat-card.tsx` — metric card with optional sparkline
- `section-card.tsx` — titled section wrapper
- `data-table.tsx` — generic table component
- `date-range-tabs.tsx` — client-side range selector

**6 section components:**
- `traffic-section.tsx` — visitors, pageviews, top pages, traffic sources
- `funnel-section.tsx` — 5-stage conversion funnel with proportional bars and drop-off rates
- `products-section.tsx` — best sellers, revenue by category
- `customers-section.tsx` — new/repeat stats, top customers, geographic breakdown
- `campaigns-section.tsx` — discount code and recommendation code performance
- `revenue-section.tsx` — revenue, AOV, sparklines, payment method breakdown

**Sidebar:** Added "Analytics" link with bar-chart icon after Dashboard

### Phase 4 — Dashboard Enhancement

- Added "Visitors Today" and "Page Views Today" stat cards with sparklines
- Changed grid to 3-column layout to accommodate 6 cards
- Added "View Full Analytics →" link below stat cards

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
