import { z } from "zod/v4";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a digit");

export const checkoutSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.email("Invalid email address"),
  phone: z.string().max(30).optional(),
  addressLine1: z.string().min(1, "Address is required").max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1, "City is required").max(200),
  state: z.string().max(200).optional(),
  postalCode: z.string().max(200).optional(),
  country: z.string().min(1, "Country is required").max(200),
  paymentMethod: z.enum(["stripe", "cod"]),
  note: z.string().max(1000).optional(),
  discountCode: z.string().max(50).optional(),
  recommendationCode: z.string().max(50).optional(),
});

export const discountCodeSchema = z.object({
  code: z.string().min(1, "Code is required").max(50).toUpperCase(),
  type: z.enum(["percentage", "fixed"]),
  // For percentage: 1-100 (will be stored as basis points * 100). For fixed: positive integer cents.
  value: z.number().int().min(1),
  maxUses: z.number().int().min(1).nullable().optional(),
  perCustomerLimit: z.number().int().min(1).default(1),
  expiresAt: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().min(1, "Slug is required").max(200).regex(slugPattern, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(5000).nullable().optional(),
  price: z.number().int().min(1, "Price must be at least 1 cent"),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(["active", "draft", "archived"]),
  tags: z.string().max(500).nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const categoryUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

const colorHexPattern = /^#[0-9A-Fa-f]{6}$/;

export const productOptionValueSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Label is required").max(100),
  colorHex: z.string().regex(colorHexPattern, "Must be a valid hex color (#RRGGBB)").nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const productOptionTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Option name is required").max(100),
  sortOrder: z.number().int().min(0).default(0),
  values: z.array(productOptionValueSchema),
});

export const productVariantSchema = z.object({
  id: z.string().optional(),
  combinationIds: z.array(z.string()),
  sku: z.string().max(100).nullable().optional(),
  priceOverride: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  imageUrl: z.string().url("Must be a valid URL").nullable().optional(),
});
