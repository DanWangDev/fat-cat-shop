import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  products,
  productImages,
  productOptionTypes,
  productOptionValues,
  productVariants,
  productVariantCombinations,
} from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { productSchema, productOptionTypeSchema, productVariantSchema } from "@/lib/validators";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const imageInputSchema = z.object({
  url: z.string(),
  altText: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

const productWithVariantsSchema = productSchema.extend({
  images: z.array(imageInputSchema).optional(),
  optionTypes: z.array(productOptionTypeSchema).optional(),
  variants: z.array(productVariantSchema).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = productWithVariantsSchema.parse(body);
    const now = new Date().toISOString();

    db.update(products)
      .set({
        title: parsed.title,
        slug: parsed.slug,
        description: parsed.description ?? null,
        price: parsed.price,
        compareAtPrice: parsed.compareAtPrice ?? null,
        categoryId: parsed.categoryId ?? null,
        status: parsed.status,
        tags: parsed.tags ?? null,
        stock: parsed.stock !== undefined ? (parsed.stock ?? null) : undefined,
        updatedAt: now,
      })
      .where(eq(products.id, id))
      .run();

    // Delete and re-insert images
    db.delete(productImages).where(eq(productImages.productId, id)).run();
    if (parsed.images) {
      for (const img of parsed.images) {
        db.insert(productImages).values({
          id: nanoid(),
          productId: id,
          url: img.url,
          altText: img.altText ?? null,
          sortOrder: img.sortOrder,
        }).run();
      }
    }

    // Delete existing option types (cascades to values), variants (cascades to combinations)
    const existingOptionTypes = db.select().from(productOptionTypes).where(eq(productOptionTypes.productId, id)).all();
    for (const ot of existingOptionTypes) {
      db.delete(productOptionTypes).where(eq(productOptionTypes.id, ot.id)).run();
    }
    const existingVariants = db.select().from(productVariants).where(eq(productVariants.productId, id)).all();
    for (const v of existingVariants) {
      db.delete(productVariants).where(eq(productVariants.id, v.id)).run();
    }

    // Re-insert option types + values
    const valueIdMap = new Map<string, string>();
    if (parsed.optionTypes) {
      for (const ot of parsed.optionTypes) {
        const otId = nanoid();
        db.insert(productOptionTypes).values({
          id: otId,
          productId: id,
          name: ot.name,
          sortOrder: ot.sortOrder,
        }).run();

        for (const ov of ot.values) {
          const ovId = nanoid();
          const clientId = ov.id ?? ovId;
          valueIdMap.set(clientId, ovId);
          db.insert(productOptionValues).values({
            id: ovId,
            optionTypeId: otId,
            label: ov.label,
            colorHex: ov.colorHex ?? null,
            sortOrder: ov.sortOrder,
          }).run();
        }
      }
    }

    // Re-insert variants + combinations
    if (parsed.variants) {
      for (const v of parsed.variants) {
        const vId = nanoid();
        db.insert(productVariants).values({
          id: vId,
          productId: id,
          sku: v.sku ?? null,
          priceOverride: v.priceOverride ?? null,
          stock: v.stock ?? null,
          imageUrl: v.imageUrl ?? null,
          createdAt: now,
          updatedAt: now,
        }).run();

        for (const combId of v.combinationIds) {
          const realId = valueIdMap.get(combId) ?? combId;
          db.insert(productVariantCombinations).values({
            id: nanoid(),
            variantId: vId,
            optionValueId: realId,
          }).run();
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update product" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    db.delete(products).where(eq(products.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete product" },
      { status: 400 },
    );
  }
}
