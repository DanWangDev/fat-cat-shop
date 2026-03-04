# Fat Cat Shop

A self-hosted e-commerce platform for small product catalogs, built with Next.js 16 and SQLite. Designed with a dynamic theme system (5 presets + custom overrides). Sells handcrafted toys, plush animals, and accessories.

## Features

### Storefront
- **Product Catalog** - Responsive grid with category support, pricing with discount display
- **Product Detail** - Image gallery, breadcrumbs, tags, product variants (colour × size), Add to Cart
- **Shopping Cart** - Zustand store with localStorage persistence, quantity controls, cross-sell recommendations
- **Checkout** - Customer info, collapsible pre-filled shipping address, discount codes, recommendation codes, order notes, returning customer auto-fill
- **Payment** - Cash on Delivery (COD); Stripe placeholder (coming soon)
- **Order Confirmation** - Success page with order number + recommendation code (if enabled)
- **Order Tracking** - Public order tracking via order number + email (`/orders/track`)
- **Transactional Emails** - Order confirmation + shipped notification emails via Resend

### Admin Dashboard (`/admin`)
- **Multi-Admin Authentication** - HMAC-signed cookie session, multiple admin accounts with scrypt password hashing, env-var fallback for initial setup
- **Dashboard** - Stats overview (products, orders, customers, revenue) + kanban-lite order columns (Unfulfilled/Shipped/Delivered) with quick action buttons
- **Product Management** - Full CRUD with category, status, tags, price, multi-image upload, product variants (option types × values)
- **Category Management** - Admin-manageable categories with inline create/edit, delete protection, sort ordering
- **Order Management** - Order list with filter tabs, detail view with visual status timeline, flexible status transitions, payment status (unpaid/paid/refunded)
- **Customer Management** - Customer list with contact info and order history, automatic deduplication by email
- **Admin User Management** - Create/delete admin accounts, view last login times (`/admin/settings/users`)
- **Discount Codes** - Percentage/fixed discounts, per-customer limits, expiry dates, usage tracking
- **Analytics** - Page-view tracking, daily aggregation, dashboard sparklines
- **Stock Management** - Per-product stock levels, "Only N left" badges, checkout stock validation
- **Site Settings** - Shop name, owner email, default shipping address, favicon, theme config, recommendation codes toggle

### Design System
- **Dynamic Themes** - 5 presets (manga, comic, pastel, neon, minimal) + custom CSS variable overrides, hot-reload polling
- **Typography** - Configurable Google Fonts per theme preset
- **Style** - Claymorphism with soft 3D shadows, rounded corners, playful hover effects
- **Accessibility** - Focus-visible rings, aria-labels, prefers-reduced-motion, 44px touch targets
- **Responsive** - Mobile-first, tested at 375px / 768px / 1024px / 1440px

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, `output: 'standalone'`) |
| Database | SQLite via better-sqlite3 |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS v4 |
| State | Zustand (cart) + React Server Components |
| Validation | Zod |
| Auth | HMAC-signed cookies + scrypt password hashing (no external deps) |
| Payment | Stripe + COD |
| Deployment | Docker + Caddy (auto HTTPS) |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm

### Installation

```bash
git clone https://github.com/DanWangDev/fat-cat-shop.git
cd fat-cat-shop
pnpm install
```

### Database Setup

Generate and run migrations, then seed with sample data:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

This creates `data/fat-cat.db` with 3 categories (Handcrafted Toys, Plush Animals, Accessories) and 8 sample products.

### Development

```bash
pnpm dev
```

Open [http://localhost:7000](http://localhost:7000) for the storefront and [http://localhost:7000/admin/login](http://localhost:7000/admin/login) for the admin panel.

**Default admin credentials:**
- Username: `admin`
- Password: `fatcat2024`

On first login, a DB admin record is auto-created. Additional admins can be managed at `/admin/settings/users`.

### Environment Variables

Copy `.env.example` and configure:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_USERNAME` | Initial admin login username (used when no DB admins exist) | `admin` |
| `ADMIN_PASSWORD` | Initial admin login password (used when no DB admins exist) | `fatcat2024` |
| `SESSION_SECRET` | HMAC signing key for session cookies | `dev-secret-change-in-production` |
| `RESEND_API_KEY` | Resend API key for transactional emails | — (emails disabled if absent) |
| `EMAIL_FROM` | Sender address for transactional emails | `noreply@yourdomain.com` |
| `OWNER_EMAIL` | Owner notification email for new orders | `grace.by.wang@gmail.com` |
| `STRIPE_SECRET_KEY` | Stripe secret key | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | — |
| `NEXT_PUBLIC_SITE_URL` | Public site URL | `http://localhost:7000` |

## Project Structure

```
src/
├── app/
│   ├── (storefront)/          # Public shop pages
│   │   ├── page.tsx           # Homepage (hero + featured products)
│   │   ├── products/          # Product list & detail
│   │   ├── cart/              # Shopping cart
│   │   └── checkout/          # Checkout & order confirmation
│   ├── admin/                 # Admin dashboard (auth-protected)
│   │   ├── login/             # Login page
│   │   └── (dashboard)/       # Dashboard, products, orders, customers, categories, settings
│   └── api/                   # API routes
│       ├── auth/              # Login/logout/me
│       ├── checkout/          # Order creation
│       ├── customers/         # Customer lookup (returning customer)
│       ├── orders/            # Public order tracking
│       ├── upload/            # Image upload
│       ├── track/             # Analytics page-view tracking
│       ├── cross-sell/        # Cart cross-sell recommendations
│       ├── public/            # Public settings (no auth)
│       ├── validate-discount/ # Discount code validation
│       ├── validate-recommendation/ # Recommendation code validation
│       └── admin/             # Admin CRUD (products, orders, categories, users, discounts)
├── components/
│   ├── storefront/            # Header, footer, product card, add-to-cart
│   └── admin/                 # Sidebar, product form, order status updater, timeline, dashboard cards
├── lib/
│   ├── db/                    # Database connection, schema, seed
│   ├── auth.ts                # Session management
│   ├── utils.ts               # formatPrice, cn
│   └── validators.ts          # Zod schemas
└── stores/
    └── cart-store.ts          # Zustand cart with localStorage
```

## Database Schema

20 tables with full relational mapping:

- **admin_users** - Admin accounts with scrypt-hashed passwords
- **categories** - Product categories with slug and sort order
- **products** - Title, slug, price (in cents), stock, status, tags
- **product_images** - Multiple images per product with sort order
- **product_option_types** - Variant axes per product (e.g. "Color", "Size")
- **product_option_values** - Values per option type (e.g. "Blue", "Small") with optional color hex
- **product_variants** - SKU, price override, stock, image per variant combination
- **product_variant_combinations** - Links variants to option values
- **customers** - Name, email, phone, notes
- **customer_addresses** - Multiple addresses per customer
- **orders** - Order number, status, payment method/status, totals, discount/recommendation codes
- **order_line_items** - Snapshot of product title and price at time of order
- **order_status_history** - Audit log of status transitions with admin attribution
- **analytics_events** - Raw pageview/event tracking
- **analytics_daily_summary** - Aggregated daily stats
- **discount_codes** - Percentage/fixed discounts with usage limits and expiry
- **discount_code_uses** - Per-customer discount usage tracking
- **recommendation_codes** - Shareable referral codes generated at checkout
- **recommendation_code_uses** - Tracks who used each recommendation code
- **site_settings** - Key-value store for shop configuration

Prices are stored as integers (cents) to avoid floating-point precision issues. Order line items snapshot product data to preserve historical accuracy.

## Production Deployment

### Docker

```bash
docker compose up -d
```

This starts:
- **app** - Next.js standalone server on port 7000
- **caddy** - Reverse proxy with automatic HTTPS

Configure your domain in `Caddyfile`:

```
your-domain.com {
    reverse_proxy app:7000
}
```

Data is persisted in a Docker volume (`app-data`).

### Manual

```bash
pnpm build
pnpm start
```

The standalone build outputs to `.next/standalone/`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |
| `pnpm db:seed` | Seed database with sample data |

## License

Private project.
