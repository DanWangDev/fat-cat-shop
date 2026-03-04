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

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = productWithVariantsSchema.parse(body);
    const now = new Date().toISOString();

    const productId = nanoid();
    const product = {
      id: productId,
      title: parsed.title,
      slug: parsed.slug,
      description: parsed.description ?? null,
      price: parsed.price,
      compareAtPrice: parsed.compareAtPrice ?? null,
      categoryId: parsed.categoryId ?? null,
      status: parsed.status,
      tags: parsed.tags ?? null,
      stock: parsed.stock ?? null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(products).values(product).run();

    // Insert images
    if (parsed.images) {
      for (const img of parsed.images) {
        db.insert(productImages).values({
          id: nanoid(),
          productId,
          url: img.url,
          altText: img.altText ?? null,
          sortOrder: img.sortOrder,
        }).run();
      }
    }

    // Insert option types + values
    const valueIdMap = new Map<string, string>();
    if (parsed.optionTypes) {
      for (const ot of parsed.optionTypes) {
        const otId = nanoid();
        db.insert(productOptionTypes).values({
          id: otId,
          productId,
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

    // Insert variants + combinations
    if (parsed.variants) {
      for (const v of parsed.variants) {
        const vId = nanoid();
        db.insert(productVariants).values({
          id: vId,
          productId,
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

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product" },
      { status: 400 },
    );
  }
}
