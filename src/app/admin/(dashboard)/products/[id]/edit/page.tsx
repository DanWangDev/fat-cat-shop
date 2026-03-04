import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { DeleteProductButton } from "@/components/admin/delete-product-button";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      images: true,
      optionTypes: {
        orderBy: (ot, { asc }) => [asc(ot.sortOrder)],
        with: {
          values: {
            orderBy: (ov, { asc }) => [asc(ov.sortOrder)],
          },
        },
      },
      variants: {
        with: {
          combinations: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const allCategories = await db.query.categories.findMany({
    orderBy: (categories, { asc }) => [asc(categories.sortOrder)],
  });

  const initialOptionTypes = product.optionTypes.map((ot) => ({
    id: ot.id,
    name: ot.name,
    sortOrder: ot.sortOrder,
    values: ot.values.map((ov) => ({
      id: ov.id,
      label: ov.label,
      colorHex: ov.colorHex,
      sortOrder: ov.sortOrder,
    })),
  }));

  const initialVariants = product.variants.map((v) => ({
    id: v.id,
    combinationIds: v.combinations.map((c) => c.optionValueId),
    sku: v.sku ?? "",
    priceOverride: v.priceOverride !== null ? (v.priceOverride / 100).toFixed(2) : "",
    stock: v.stock !== null ? v.stock.toString() : "",
  }));

  const initialImages = product.images.map((img) => ({
    id: img.id,
    url: img.url,
    altText: img.altText ?? "",
    sortOrder: img.sortOrder,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-warm-brown">
          Edit Product
        </h1>
        <DeleteProductButton productId={product.id} />
      </div>
      <div className="mt-6">
        <ProductForm
          product={product}
          categories={allCategories}
          initialOptionTypes={initialOptionTypes}
          initialVariants={initialVariants}
          initialImages={initialImages}
        />
      </div>
    </div>
  );
}
