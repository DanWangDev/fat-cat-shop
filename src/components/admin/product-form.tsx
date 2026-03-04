"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
}

interface OptionValueData {
  id: string;
  label: string;
  colorHex: string | null;
  sortOrder: number;
}

interface OptionTypeData {
  id: string;
  name: string;
  sortOrder: number;
  values: OptionValueData[];
}

interface VariantData {
  id: string;
  combinationIds: string[];
  sku: string;
  priceOverride: string;
  stock: string;
}

interface ImageData {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
}

interface ProductFormProps {
  product?: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    price: number;
    compareAtPrice: number | null;
    categoryId: string | null;
    status: string;
    tags: string | null;
    stock: number | null;
  };
  categories: Category[];
  initialOptionTypes?: OptionTypeData[];
  initialVariants?: VariantData[];
  initialImages?: ImageData[];
}

let nextTempId = 1;
function tempId() {
  return `tmp-${nextTempId++}`;
}

export function ProductForm({ product, categories, initialOptionTypes, initialVariants, initialImages }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!product;

  const [images, setImages] = useState<ImageData[]>(initialImages ?? []);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    price: product ? (product.price / 100).toFixed(2) : "",
    compareAtPrice: product?.compareAtPrice
      ? (product.compareAtPrice / 100).toFixed(2)
      : "",
    categoryId: product?.categoryId ?? "",
    status: product?.status ?? "draft",
    tags: product?.tags ?? "",
    stock: product?.stock !== undefined && product?.stock !== null ? product.stock.toString() : "",
  });

  const [optionTypes, setOptionTypes] = useState<OptionTypeData[]>(initialOptionTypes ?? []);
  const [variants, setVariants] = useState<VariantData[]>(initialVariants ?? []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: string, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "title" && !isEditing) {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      return updated;
    });
  }

  // --- Option type management ---
  function addOptionType() {
    setOptionTypes((prev) => [
      ...prev,
      { id: tempId(), name: "", sortOrder: prev.length, values: [] },
    ]);
  }

  function removeOptionType(otId: string) {
    setOptionTypes((prev) => prev.filter((ot) => ot.id !== otId));
    setVariants([]);
  }

  function updateOptionTypeName(otId: string, name: string) {
    setOptionTypes((prev) =>
      prev.map((ot) => (ot.id === otId ? { ...ot, name } : ot)),
    );
  }

  function addOptionValue(otId: string) {
    setOptionTypes((prev) =>
      prev.map((ot) =>
        ot.id === otId
          ? {
              ...ot,
              values: [
                ...ot.values,
                { id: tempId(), label: "", colorHex: null, sortOrder: ot.values.length },
              ],
            }
          : ot,
      ),
    );
  }

  function removeOptionValue(otId: string, valId: string) {
    setOptionTypes((prev) =>
      prev.map((ot) =>
        ot.id === otId
          ? { ...ot, values: ot.values.filter((v) => v.id !== valId) }
          : ot,
      ),
    );
    setVariants([]);
  }

  function updateOptionValue(otId: string, valId: string, field: "label" | "colorHex", value: string | null) {
    setOptionTypes((prev) =>
      prev.map((ot) =>
        ot.id === otId
          ? {
              ...ot,
              values: ot.values.map((v) =>
                v.id === valId ? { ...v, [field]: value } : v,
              ),
            }
          : ot,
      ),
    );
  }

  // --- Variant generation ---
  function generateVariants() {
    if (optionTypes.length === 0) {
      setVariants([]);
      return;
    }

    const validTypes = optionTypes.filter(
      (ot) => ot.name.trim() && ot.values.some((v) => v.label.trim()),
    );
    if (validTypes.length === 0) {
      setVariants([]);
      return;
    }

    const valueLists = validTypes.map((ot) =>
      ot.values.filter((v) => v.label.trim()),
    );

    // Cartesian product
    const combos: OptionValueData[][] = valueLists.reduce<OptionValueData[][]>(
      (acc, vals) => {
        if (acc.length === 0) return vals.map((v) => [v]);
        const result: OptionValueData[][] = [];
        for (const existing of acc) {
          for (const val of vals) {
            result.push([...existing, val]);
          }
        }
        return result;
      },
      [],
    );

    const newVariants: VariantData[] = combos.map((combo) => {
      const combIds = combo.map((v) => v.id);
      // Preserve existing variant data if it matches
      const existingVariant = variants.find(
        (ev) =>
          ev.combinationIds.length === combIds.length &&
          combIds.every((id) => ev.combinationIds.includes(id)),
      );
      return {
        id: existingVariant?.id ?? tempId(),
        combinationIds: combIds,
        sku: existingVariant?.sku ?? "",
        priceOverride: existingVariant?.priceOverride ?? "",
        stock: existingVariant?.stock ?? "",
      };
    });

    setVariants(newVariants);
  }

  function updateVariantField(vId: string, field: "sku" | "priceOverride" | "stock", value: string) {
    setVariants((prev) =>
      prev.map((v) => (v.id === vId ? { ...v, [field]: value } : v)),
    );
  }

  function getVariantLabel(variant: VariantData): string {
    return variant.combinationIds
      .map((cId) => {
        for (const ot of optionTypes) {
          const val = ot.values.find((v) => v.id === cId);
          if (val) return val.label;
        }
        return "?";
      })
      .join(" / ");
  }

  // --- Image management ---
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Upload failed");
        }
        const data = await res.json();
        setImages((prev) => [
          ...prev,
          { id: tempId(), url: data.url, altText: "", sortOrder: prev.length },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeImage(imgId: string) {
    setImages((prev) => prev.filter((img) => img.id !== imgId));
  }

  function updateImageAlt(imgId: string, altText: string) {
    setImages((prev) =>
      prev.map((img) => (img.id === imgId ? { ...img, altText } : img)),
    );
  }

  function moveImage(imgId: string, direction: -1 | 1) {
    setImages((prev) => {
      const idx = prev.findIndex((img) => img.id === imgId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const updated = [...prev];
      [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
      return updated.map((img, i) => ({ ...img, sortOrder: i }));
    });
  }

  // --- Submit ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const priceInCents = Math.round(parseFloat(form.price) * 100);
      const compareAtPriceInCents = form.compareAtPrice
        ? Math.round(parseFloat(form.compareAtPrice) * 100)
        : null;

      const validOptionTypes = optionTypes
        .filter((ot) => ot.name.trim() && ot.values.some((v) => v.label.trim()))
        .map((ot, i) => ({
          id: ot.id,
          name: ot.name.trim(),
          sortOrder: i,
          values: ot.values
            .filter((v) => v.label.trim())
            .map((v, j) => ({
              id: v.id,
              label: v.label.trim(),
              colorHex: v.colorHex || null,
              sortOrder: j,
            })),
        }));

      const validVariants = variants.map((v) => ({
        id: v.id,
        combinationIds: v.combinationIds,
        sku: v.sku.trim() || null,
        priceOverride: v.priceOverride.trim()
          ? Math.round(parseFloat(v.priceOverride) * 100)
          : null,
        stock: v.stock.trim() !== "" ? parseInt(v.stock, 10) : null,
      }));

      const body = {
        title: form.title,
        slug: form.slug,
        description: form.description || null,
        price: priceInCents,
        compareAtPrice: compareAtPriceInCents,
        categoryId: form.categoryId || null,
        status: form.status,
        tags: form.tags || null,
        stock: form.stock.trim() !== "" ? parseInt(form.stock, 10) : null,
        images: images.map((img, i) => ({
          url: img.url,
          altText: img.altText || null,
          sortOrder: i,
        })),
        optionTypes: validOptionTypes.length > 0 ? validOptionTypes : undefined,
        variants: validVariants.length > 0 ? validVariants : undefined,
      };

      const url = isEditing
        ? `/api/admin/products/${product.id}`
        : "/api/admin/products";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        const message =
          Array.isArray(data.details) && data.details.length > 0
            ? data.details[0].message
            : data.error ?? "Failed to save product";
        throw new Error(message);
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-warm-brown/20 px-4 py-2 text-sm text-warm-brown outline-none focus:border-teal-primary";
  const labelClass = "mb-1 block text-sm font-medium text-warm-brown/70";

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl space-y-6 rounded-xl bg-white p-6 shadow-sm"
    >
      <div>
        <label className={labelClass}>
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          Slug <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => updateField("slug", e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={4}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Price (GBP) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.price}
            onChange={(e) => updateField("price", e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Compare at Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.compareAtPrice}
            onChange={(e) => updateField("compareAtPrice", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Category</label>
        <select
          value={form.categoryId}
          onChange={(e) => updateField("categoryId", e.target.value)}
          className={inputClass}
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Stock quantity</label>
        <input
          type="number"
          min="0"
          value={form.stock}
          onChange={(e) => updateField("stock", e.target.value)}
          placeholder="Leave empty for unlimited"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-warm-brown/50">
          Leave empty for unlimited stock. If variants are configured, per-variant stock is used instead.
        </p>
      </div>

      <div>
        <label className={labelClass}>
          Status <span className="text-red-400">*</span>
        </label>
        <select
          value={form.status}
          onChange={(e) => updateField("status", e.target.value)}
          className={inputClass}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Tags (comma-separated)</label>
        <input
          type="text"
          value={form.tags}
          onChange={(e) => updateField("tags", e.target.value)}
          placeholder="e.g., toy, interactive, bestseller"
          className={inputClass}
        />
      </div>

      {/* ===== PRODUCT IMAGES ===== */}
      <div>
        <label className={labelClass}>Product Images</label>
        <div className="mt-2 space-y-3">
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="group relative overflow-hidden rounded-lg border border-warm-brown/20"
                >
                  <div className="aspect-square bg-warm-gray">
                    <img
                      src={img.url}
                      alt={img.altText || "Product image"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {idx === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-teal-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Main
                    </span>
                  )}
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => moveImage(img.id, -1)}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-black/60 text-xs text-white hover:bg-black/80"
                        title="Move left"
                      >
                        &larr;
                      </button>
                    )}
                    {idx < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveImage(img.id, 1)}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-black/60 text-xs text-white hover:bg-black/80"
                        title="Move right"
                      >
                        &rarr;
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-red-500/80 text-xs text-white hover:bg-red-600"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                  <input
                    type="text"
                    value={img.altText}
                    onChange={(e) => updateImageAlt(img.id, e.target.value)}
                    placeholder="Alt text"
                    className="w-full border-t border-warm-brown/10 px-2 py-1 text-xs text-warm-brown outline-none placeholder:text-warm-brown/30 focus:border-teal-primary"
                  />
                </div>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-warm-brown/20 py-6 transition-colors hover:border-teal-primary/40">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warm-brown/30">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span className="mt-2 text-sm text-warm-brown/50">
              {uploading ? "Uploading..." : "Click to upload images"}
            </span>
            <span className="mt-1 text-xs text-warm-brown/30">
              JPEG, PNG, WebP up to 10MB
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleImageUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ===== VARIANT BUILDER ===== */}
      <div className="rounded-lg border border-warm-brown/20 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-warm-brown">Product Variants</h3>
          <button
            type="button"
            onClick={addOptionType}
            className="rounded-lg bg-teal-primary/10 px-3 py-1 text-xs font-bold text-teal-primary transition-colors hover:bg-teal-primary/20"
          >
            + Add Option (e.g., Color, Size)
          </button>
        </div>

        {optionTypes.length === 0 && (
          <p className="mt-2 text-xs text-warm-brown/50">
            No variants configured. Add options like Color or Size to create product variants.
          </p>
        )}

        {optionTypes.map((ot, otIdx) => (
          <div key={ot.id} className="mt-4 rounded-lg border border-warm-brown/10 bg-warm-gray/30 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ot.name}
                onChange={(e) => updateOptionTypeName(ot.id, e.target.value)}
                placeholder="Option name (e.g., Color)"
                className="flex-1 rounded-lg border border-warm-brown/20 px-3 py-1.5 text-sm text-warm-brown outline-none focus:border-teal-primary"
              />
              <button
                type="button"
                onClick={() => removeOptionType(ot.id)}
                className="text-xs font-bold text-red-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>

            <div className="mt-2 space-y-1.5">
              {ot.values.map((val) => (
                <div key={val.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={val.label}
                    onChange={(e) => updateOptionValue(ot.id, val.id, "label", e.target.value)}
                    placeholder="Value (e.g., Red)"
                    className="flex-1 rounded border border-warm-brown/15 px-2 py-1 text-sm text-warm-brown outline-none focus:border-teal-primary"
                  />
                  <input
                    type="color"
                    value={val.colorHex || "#000000"}
                    onChange={(e) => updateOptionValue(ot.id, val.id, "colorHex", e.target.value)}
                    title="Color swatch (optional)"
                    className="h-7 w-7 cursor-pointer rounded border border-warm-brown/20 p-0"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateOptionValue(ot.id, val.id, "colorHex", null);
                    }}
                    title="Clear color"
                    className="text-xs text-warm-brown/40 hover:text-warm-brown/70"
                  >
                    x
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOptionValue(ot.id, val.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOptionValue(ot.id)}
                className="text-xs font-bold text-teal-primary hover:text-teal-dark"
              >
                + Add value
              </button>
            </div>
          </div>
        ))}

        {optionTypes.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={generateVariants}
              className="rounded-lg bg-teal-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-dark"
            >
              Generate Variants
            </button>
          </div>
        )}

        {variants.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-warm-brown/70">
              {variants.length} variant{variants.length !== 1 ? "s" : ""}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-brown/10 text-left text-xs font-bold text-warm-brown/60">
                    <th className="pb-1 pr-2">Variant</th>
                    <th className="pb-1 pr-2">SKU</th>
                    <th className="pb-1 pr-2">Price Override (GBP)</th>
                    <th className="pb-1">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="border-b border-warm-brown/5">
                      <td className="py-1.5 pr-2 text-xs font-medium text-warm-brown">
                        {getVariantLabel(v)}
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => updateVariantField(v.id, "sku", e.target.value)}
                          placeholder="SKU"
                          className="w-24 rounded border border-warm-brown/15 px-2 py-1 text-xs text-warm-brown outline-none focus:border-teal-primary"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.priceOverride}
                          onChange={(e) => updateVariantField(v.id, "priceOverride", e.target.value)}
                          placeholder="Default"
                          className="w-24 rounded border border-warm-brown/15 px-2 py-1 text-xs text-warm-brown outline-none focus:border-teal-primary"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) => updateVariantField(v.id, "stock", e.target.value)}
                          placeholder="Unlimited"
                          className="w-20 rounded border border-warm-brown/15 px-2 py-1 text-xs text-warm-brown outline-none focus:border-teal-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-teal-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
        >
          {loading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-warm-brown/20 px-8 py-2.5 text-sm font-medium text-warm-brown transition-colors hover:bg-warm-gray"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
