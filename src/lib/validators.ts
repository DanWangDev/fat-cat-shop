import { z } from "zod/v4";

export const checkoutSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Invalid email address"),
  phone: z.string().optional(),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  paymentMethod: z.enum(["stripe", "cod"]),
  note: z.string().optional(),
  discountCode: z.string().optional(),
  recommendationCode: z.string().optional(),
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

export const productSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().nullable().optional(),
  price: z.number().int().min(1, "Price must be at least 1 cent"),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(["active", "draft", "archived"]),
  tags: z.string().nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const categoryUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const productOptionValueSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Label is required"),
  colorHex: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const productOptionTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Option name is required"),
  sortOrder: z.number().int().min(0).default(0),
  values: z.array(productOptionValueSchema),
});

export const productVariantSchema = z.object({
  id: z.string().optional(),
  combinationIds: z.array(z.string()),
  sku: z.string().nullable().optional(),
  priceOverride: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});
