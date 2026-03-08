# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Dev server on http://localhost:7000
pnpm build            # Production build (standalone output)
pnpm lint             # ESLint (Next.js core-web-vitals + typescript config)
pnpm db:generate      # Generate Drizzle migrations from schema changes
pnpm db:migrate       # Run pending migrations
pnpm db:studio        # Open Drizzle Studio DB browser
pnpm db:seed          # Seed database with sample data (tsx src/lib/db/seed.ts)
```

No test framework is configured yet.

## Architecture

**Fat Cat Shop** is a self-hosted e-commerce app built with Next.js 16 (App Router), SQLite (better-sqlite3), Drizzle ORM, Tailwind CSS v4, and Zustand.

### Route Groups

The app uses Next.js route groups to separate two distinct areas with their own layouts:

- `src/app/(storefront)/` — Public shop (header/footer layout). Pages: homepage, product list, product detail, cart, checkout, order tracking.
- `src/app/admin/(dashboard)/` — Auth-protected admin panel (sidebar layout). Auth check in layout redirects to `/admin/login` if unauthenticated.

### API Routes

All under `src/app/api/`. Admin endpoints check `isAuthenticated()` from `src/lib/auth.ts`. Pattern: parse request with Zod, interact with DB via Drizzle, return `NextResponse.json()`.

- `/api/auth/*` — Login/logout/me (HMAC-signed cookie sessions)
- `/api/admin/*` — CRUD for products, categories, orders, users, theme, settings
- `/api/checkout` — Order creation (validates cart items against DB, creates customer/order/line items)
- `/api/theme` — Public endpoint for theme CSS vars (used by hot-reload polling)
- `/api/upload` — Image upload to `data/uploads/`
- `/api/uploads/[...path]` — Static file serving for uploaded images (rewritten from `/uploads/:path*`)

### Database

SQLite file at `data/fat-cat.db`. Schema in `src/lib/db/schema.ts`. Migrations in `drizzle/migrations/`.

- Connection singleton with lazy init via Proxy in `src/lib/db/index.ts`
- WAL mode enabled, foreign keys enforced
- Prices stored as integers (cents), formatted with `formatPrice()` from `src/lib/utils.ts` (GBP currency)
- IDs generated with `nanoid()`

### Theme System

Dynamic theming with runtime CSS variable switching:

- `src/lib/theme/types.ts` — `ThemePreset` interface (colors, shadows, fonts, googleFonts)
- `src/lib/theme/presets/` — Five presets: manga (default), comic, pastel, neon, minimal
- `src/lib/theme/presets.ts` — Registry (`PRESETS` record) and exports
- `src/lib/theme/get-active-theme.ts` — Reads `theme_config` from `site_settings` table, falls back to manga
- `src/lib/theme/build-css-vars.ts` — Converts preset + custom overrides to inline CSS vars
- Root layout (`src/app/layout.tsx`) applies CSS vars as `style` on `<html>`
- `src/components/storefront/theme-hot-reload.tsx` — Client component that polls `/api/theme` every 2s and applies changes via `document.documentElement.style.setProperty()`
- `globals.css` uses `@theme` block defining Tailwind v4 theme tokens — these are the compile-time defaults; runtime overrides come from inline styles

### State Management

- **Server**: React Server Components for data fetching (most pages)
- **Client**: Zustand store for cart (`src/stores/cart-store.ts`) with `localStorage` persistence

### Auth

Cookie-based sessions with HMAC signing (no external auth library). Multi-admin support with scrypt password hashing. Env vars (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) used as fallback for initial setup (required — app throws if not set). Session logic in `src/lib/auth.ts`. Sessions expire after 1 day. Cookies use `sameSite: "strict"`.

### Security

- **Rate limiting**: In-memory sliding window (`src/lib/rate-limit.ts`). Applied to login (5/15min), checkout (10/min), customer lookup (10/min).
- **CSRF**: `src/middleware.ts` validates `Origin` header on API mutations.
- **Admin access gate**: If `ADMIN_ACCESS_TOKEN` env var is set, `/admin` routes require `?access=<token>` (sets a 4-hour cookie on first valid access). Returns 404 on unauthorized.
- **Security headers**: CSP, X-Frame-Options DENY, HSTS, nosniff, Permissions-Policy — configured in `next.config.ts` `headers()`.
- **Input validation**: All string fields have `.max()` constraints. Passwords require uppercase + lowercase + digit. Slugs and color hex values are regex-validated.
- **Env vars required**: `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` must be set (no hardcoded defaults).

### Site Settings

Key-value store in `site_settings` table. Managed via `src/lib/site-settings.ts` with typed defaults in `SiteSettingsMap`. Used for site title, hero text, footer text, favicon, theme config, etc.

### Key Conventions

- Path alias: `@/*` maps to `src/*`
- Validation: Zod v4 schemas in `src/lib/validators.ts` (imported as `zod/v4`)
- `cn()` utility for conditional class joining (not using clsx/tailwind-merge)
- Order status transitions enforced via `VALID_STATUS_TRANSITIONS` in `src/lib/utils.ts`
- `output: "standalone"` in next.config.ts for Docker deployment
- Upload rewrite: `/uploads/:path*` → `/api/uploads/:path*`
