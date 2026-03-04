import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// A1: Admin users table for multi-admin auth
export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  lastLoginAt: text("last_login_at"),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: integer("price").notNull(),
  compareAtPrice: integer("compare_at_price"),
  categoryId: text("category_id").references(() => categories.id),
  status: text("status", { enum: ["active", "draft", "archived"] })
    .notNull()
    .default("draft"),
  tags: text("tags"),
  stock: integer("stock"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ([
  index("idx_products_category_id").on(table.categoryId),
  index("idx_products_status").on(table.status),
]));

export const productImages = sqliteTable("product_images", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  altText: text("alt_text"),
  width: integer("width"),
  height: integer("height"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ([
  uniqueIndex("idx_customers_email").on(table.email),
]));

export const customerAddresses = sqliteTable("customer_addresses", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: text("customer_id").references(() => customers.id),
  status: text("status", {
    enum: ["pending", "confirmed", "shipped", "delivered", "completed", "returned", "cancelled"],
  })
    .notNull()
    .default("pending"),
  paymentStatus: text("payment_status", {
    enum: ["unpaid", "paid", "refunded"],
  })
    .notNull()
    .default("unpaid"),
  paymentMethod: text("payment_method", { enum: ["stripe", "cod"] }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  subtotal: integer("subtotal").notNull(),
  shippingCost: integer("shipping_cost").notNull().default(0),
  total: integer("total").notNull(),
  note: text("note"),
  shippingAddress: text("shipping_address"),
  discountCode: text("discount_code"),
  discountAmount: integer("discount_amount").notNull().default(0),
  recommendationCode: text("recommendation_code"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ([
  index("idx_orders_status").on(table.status),
  index("idx_orders_customer_id").on(table.customerId),
  index("idx_orders_created_at").on(table.createdAt),
  index("idx_orders_payment_status").on(table.paymentStatus),
]));

export const orderLineItems = sqliteTable("order_line_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id),
  variantId: text("variant_id"),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  total: integer("total").notNull(),
});

export const orderStatusHistory = sqliteTable("order_status_history", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  event: text("event").notNull(),
  path: text("path").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
}, (table) => ([
  index("idx_analytics_events_created_at").on(table.createdAt),
  index("idx_analytics_events_event").on(table.event),
  index("idx_analytics_events_visitor_id").on(table.visitorId),
  index("idx_analytics_events_path").on(table.path),
]));

export const analyticsDailySummary = sqliteTable("analytics_daily_summary", {
  id: text("id").primaryKey(),
  date: text("date").notNull().unique(),
  uniqueVisitors: integer("unique_visitors").notNull().default(0),
  pageViews: integer("page_views").notNull().default(0),
  ordersCount: integer("orders_count").notNull().default(0),
  revenue: integer("revenue").notNull().default(0),
});

export const discountCodes = sqliteTable("discount_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["percentage", "fixed"] }).notNull(),
  // For percentage: value in basis points (1000 = 10%). For fixed: value in cents.
  value: integer("value").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  perCustomerLimit: integer("per_customer_limit").notNull().default(1),
  expiresAt: text("expires_at"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ([
  uniqueIndex("idx_discount_codes_code").on(table.code),
]));

export const discountCodeUses = sqliteTable("discount_code_uses", {
  id: text("id").primaryKey(),
  codeId: text("code_id")
    .notNull()
    .references(() => discountCodes.id, { onDelete: "cascade" }),
  customerEmail: text("customer_email").notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  usedAt: text("used_at").notNull(),
});

export const recommendationCodes = sqliteTable("recommendation_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerEmail: text("customer_email").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ([
  uniqueIndex("idx_recommendation_codes_code").on(table.code),
]));

export const recommendationCodeUses = sqliteTable("recommendation_code_uses", {
  id: text("id").primaryKey(),
  codeId: text("code_id")
    .notNull()
    .references(() => recommendationCodes.id, { onDelete: "cascade" }),
  usedByEmail: text("used_by_email").notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  usedAt: text("used_at").notNull(),
});

export const productOptionTypes = sqliteTable("product_option_types", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productOptionValues = sqliteTable("product_option_values", {
  id: text("id").primaryKey(),
  optionTypeId: text("option_type_id")
    .notNull()
    .references(() => productOptionTypes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  colorHex: text("color_hex"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku"),
  priceOverride: integer("price_override"),
  stock: integer("stock"),
  imageUrl: text("image_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const productVariantCombinations = sqliteTable("product_variant_combinations", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => productVariants.id, { onDelete: "cascade" }),
  optionValueId: text("option_value_id")
    .notNull()
    .references(() => productOptionValues.id, { onDelete: "cascade" }),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Relations
export const adminUsersRelations = relations(adminUsers, () => ({}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
  optionTypes: many(productOptionTypes),
  variants: many(productVariants),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(customerAddresses),
  orders: many(orders),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  lineItems: many(orderLineItems),
  statusHistory: many(orderStatusHistory),
}));

export const orderLineItemsRelations = relations(orderLineItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderLineItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderLineItems.productId],
    references: [products.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusHistory.orderId],
    references: [orders.id],
  }),
}));

export const discountCodesRelations = relations(discountCodes, ({ many }) => ({
  uses: many(discountCodeUses),
}));

export const discountCodeUsesRelations = relations(discountCodeUses, ({ one }) => ({
  code: one(discountCodes, {
    fields: [discountCodeUses.codeId],
    references: [discountCodes.id],
  }),
}));

export const recommendationCodesRelations = relations(recommendationCodes, ({ one, many }) => ({
  order: one(orders, {
    fields: [recommendationCodes.orderId],
    references: [orders.id],
  }),
  uses: many(recommendationCodeUses),
}));

export const recommendationCodeUsesRelations = relations(recommendationCodeUses, ({ one }) => ({
  code: one(recommendationCodes, {
    fields: [recommendationCodeUses.codeId],
    references: [recommendationCodes.id],
  }),
}));

export const productOptionTypesRelations = relations(productOptionTypes, ({ one, many }) => ({
  product: one(products, {
    fields: [productOptionTypes.productId],
    references: [products.id],
  }),
  values: many(productOptionValues),
}));

export const productOptionValuesRelations = relations(productOptionValues, ({ one }) => ({
  optionType: one(productOptionTypes, {
    fields: [productOptionValues.optionTypeId],
    references: [productOptionTypes.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  combinations: many(productVariantCombinations),
}));

export const productVariantCombinationsRelations = relations(productVariantCombinations, ({ one }) => ({
  variant: one(productVariants, {
    fields: [productVariantCombinations.variantId],
    references: [productVariants.id],
  }),
  optionValue: one(productOptionValues, {
    fields: [productVariantCombinations.optionValueId],
    references: [productOptionValues.id],
  }),
}));
