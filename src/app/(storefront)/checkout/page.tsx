"use client";

import { useCartStore } from "@/stores/cart-store";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returningCustomer, setReturningCustomer] = useState<{
    firstName: string;
    lastName: string;
    phone: string | null;
    address: {
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      state: string | null;
      postalCode: string | null;
      country: string;
    } | null;
  } | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    paymentMethod: "cod" as "stripe" | "cod",
    note: "",
  });

  const [addressOpen, setAddressOpen] = useState(false);

  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountAmount: number;
    type: string;
    value: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  const checkoutTrackedRef = useRef(false);

  const [recCodeEnabled, setRecCodeEnabled] = useState(false);
  const [recCodeInput, setRecCodeInput] = useState("");
  const [recCodeValid, setRecCodeValid] = useState<boolean | null>(null);
  const [recCodeError, setRecCodeError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (form.paymentMethod === "stripe") {
      setForm((prev) => ({ ...prev, paymentMethod: "cod" }));
    }

    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.defaultAddress) {
          const addr = data.defaultAddress;
          setForm((prev) => ({
            ...prev,
            addressLine1: prev.addressLine1 || addr.addressLine1 || "",
            city: prev.city || addr.city || "",
            postalCode: prev.postalCode || addr.postalCode || "",
            country: prev.country || addr.country || "",
          }));
        }
        if (data.enableRecommendationCodes) {
          setRecCodeEnabled(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mounted && items.length > 0 && !checkoutTrackedRef.current) {
      checkoutTrackedRef.current = true;
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "checkout_started",
          path: "/checkout",
          metadata: { itemCount: items.length, subtotal: totalPrice() },
        }),
      }).catch(() => {});
    }
  }, [mounted, items.length]);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 border-3 border-comic-ink/20 bg-comic-light-gray" />
          <div className="mt-8 h-96 border-3 border-comic-ink/20 bg-comic-light-gray" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-comic-ink">
          Checkout
        </h1>
        <div className="mt-12 text-center">
          <p className="font-bold text-comic-ink/60">Your cart is empty.</p>
          <Link
            href="/products"
            className="mt-6 inline-block border-3 border-comic-ink bg-comic-red px-8 py-3 font-display text-base font-bold text-comic-on-primary shadow-comic transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleEmailBlur() {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email)) return;

    try {
      const res = await fetch(
        `/api/customers/lookup?email=${encodeURIComponent(form.email)}`,
      );
      const data = await res.json();

      if (data.found) {
        setReturningCustomer(data.customer);
        setShowWelcomeBanner(true);
      } else {
        setReturningCustomer(null);
        setShowWelcomeBanner(false);
      }
    } catch {
      setReturningCustomer(null);
      setShowWelcomeBanner(false);
    }
  }

  function applySavedDetails() {
    if (!returningCustomer) return;

    setForm((prev) => ({
      ...prev,
      firstName: returningCustomer.firstName,
      lastName: returningCustomer.lastName,
      phone: returningCustomer.phone ?? prev.phone,
      addressLine1: returningCustomer.address?.addressLine1 ?? prev.addressLine1,
      addressLine2: returningCustomer.address?.addressLine2 ?? prev.addressLine2,
      city: returningCustomer.address?.city ?? prev.city,
      state: returningCustomer.address?.state ?? prev.state,
      postalCode: returningCustomer.address?.postalCode ?? prev.postalCode,
      country: returningCustomer.address?.country ?? prev.country,
    }));
    setShowWelcomeBanner(false);
  }

  async function applyDiscount() {
    const code = discountInput.trim();
    if (!code) return;

    setDiscountLoading(true);
    setDiscountError(null);
    setAppliedDiscount(null);

    try {
      const subtotal = totalPrice();
      const params = new URLSearchParams({
        code,
        subtotal: String(subtotal),
        email: form.email,
      });
      const res = await fetch(`/api/validate-discount?${params}`);
      const data = await res.json();

      if (data.valid) {
        setAppliedDiscount(data);
      } else {
        setDiscountError(data.error ?? "Invalid code");
      }
    } catch {
      setDiscountError("Could not validate code");
    } finally {
      setDiscountLoading(false);
    }
  }

  function removeDiscount() {
    setAppliedDiscount(null);
    setDiscountInput("");
    setDiscountError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          discountCode: appliedDiscount?.code,
          recommendationCode: recCodeValid ? recCodeInput.trim().toUpperCase() : undefined,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? undefined,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Checkout failed");
      }

      if (form.paymentMethod === "stripe" && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "purchase",
          path: "/checkout",
          metadata: {
            orderNumber: data.orderNumber,
            total: Math.max(totalPrice() - (appliedDiscount?.discountAmount ?? 0), 0),
          },
        }),
      }).catch(() => {});

      clearCart();
      const successUrl = data.recommendationCode
        ? `/checkout/success?order=${data.orderNumber}&recCode=${data.recommendationCode}`
        : `/checkout/success?order=${data.orderNumber}`;
      router.push(successUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-comic-ink">
        Checkout
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Customer Info */}
        <div className="space-y-6 lg:col-span-3">
          <div className="border-3 border-comic-ink bg-comic-panel p-6 shadow-comic">
            <h2 className="font-display text-lg font-bold text-comic-ink">
              Contact Information
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                label="First Name"
                value={form.firstName}
                onChange={(v) => updateField("firstName", v)}
                required
              />
              <InputField
                label="Last Name"
                value={form.lastName}
                onChange={(v) => updateField("lastName", v)}
                required
              />
              <InputField
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => updateField("email", v)}
                onBlur={handleEmailBlur}
                required
              />
              <InputField
                label="Phone / WhatsApp (optional)"
                value={form.phone}
                onChange={(v) => updateField("phone", v)}
              />
            </div>

            {showWelcomeBanner && returningCustomer && (
              <div className="mt-4 flex items-center justify-between border-2 border-comic-cyan bg-comic-cyan/20 px-4 py-3">
                <span className="text-sm font-bold text-comic-ink">
                  Welcome back, {returningCustomer.firstName}!
                </span>
                <button
                  type="button"
                  onClick={applySavedDetails}
                  className="cursor-pointer border-2 border-comic-ink bg-comic-cyan px-3 py-1 text-sm font-bold text-comic-on-secondary transition-colors hover:bg-comic-cyan-dark"
                >
                  Use saved details
                </button>
              </div>
            )}
          </div>

          <div className="border-3 border-comic-ink bg-comic-panel shadow-comic">
            <button
              type="button"
              onClick={() => setAddressOpen((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between p-6"
            >
              <div className="text-left">
                <h2 className="font-display text-lg font-bold text-comic-ink">
                  Shipping Address
                </h2>
                {!addressOpen && (form.addressLine1 || form.city || form.country) && (
                  <p className="mt-1 text-sm text-comic-ink/60">
                    {[form.addressLine1, form.city, form.postalCode, form.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
              <span className="text-comic-ink/50 text-lg font-bold">
                {addressOpen ? "\u2212" : "+"}
              </span>
            </button>
            {addressOpen && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <InputField
                      label="Address Line 1"
                      value={form.addressLine1}
                      onChange={(v) => updateField("addressLine1", v)}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <InputField
                      label="Address Line 2"
                      value={form.addressLine2}
                      onChange={(v) => updateField("addressLine2", v)}
                    />
                  </div>
                  <InputField
                    label="City"
                    value={form.city}
                    onChange={(v) => updateField("city", v)}
                    required
                  />
                  <InputField
                    label="State / Province"
                    value={form.state}
                    onChange={(v) => updateField("state", v)}
                  />
                  <InputField
                    label="Postal Code"
                    value={form.postalCode}
                    onChange={(v) => updateField("postalCode", v)}
                  />
                  <InputField
                    label="Country"
                    value={form.country}
                    onChange={(v) => updateField("country", v)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-3 border-comic-ink bg-comic-panel p-6 shadow-comic">
            <h2 className="font-display text-lg font-bold text-comic-ink">
              Payment Method
            </h2>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 border-2 border-comic-ink p-4 transition-all hover:bg-comic-red/10">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={form.paymentMethod === "cod"}
                  onChange={() => updateField("paymentMethod", "cod")}
                  className="accent-comic-red"
                />
                <span className="font-bold text-comic-ink">
                  Cash on Delivery (COD)
                </span>
              </label>
              <label className="flex items-center gap-3 border-2 border-comic-ink p-4 opacity-50 cursor-not-allowed">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="stripe"
                  checked={form.paymentMethod === "stripe"}
                  onChange={() => updateField("paymentMethod", "stripe")}
                  disabled
                  className="accent-comic-red"
                />
                <span className="font-bold text-comic-ink">
                  Pay with Card (Stripe)
                </span>
                <span className="ml-auto border-2 border-comic-ink/30 bg-comic-light-gray px-2 py-0.5 text-xs font-bold text-comic-ink/50">
                  Coming soon
                </span>
              </label>
            </div>
          </div>

          {recCodeEnabled && (
            <div className="border-3 border-comic-ink bg-comic-panel p-6 shadow-comic">
              <h2 className="font-display text-lg font-bold text-comic-ink">
                Recommendation Code
              </h2>
              <p className="mt-1 text-xs font-bold text-comic-ink/50">
                Got a code from a friend? Enter it here.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={recCodeInput}
                  onChange={(e) => {
                    setRecCodeInput(e.target.value.toUpperCase());
                    setRecCodeValid(null);
                    setRecCodeError(null);
                  }}
                  placeholder="FC-XXXX"
                  className="flex-1 border-2 border-comic-ink px-4 py-2 text-sm font-bold uppercase text-comic-ink outline-none transition-colors focus:border-comic-cyan"
                />
                <button
                  type="button"
                  disabled={!recCodeInput.trim()}
                  onClick={async () => {
                    setRecCodeError(null);
                    setRecCodeValid(null);
                    try {
                      const params = new URLSearchParams({
                        code: recCodeInput.trim(),
                        email: form.email,
                      });
                      const res = await fetch(`/api/validate-recommendation?${params}`);
                      const data = await res.json();
                      if (data.valid) {
                        setRecCodeValid(true);
                      } else {
                        setRecCodeError(data.error ?? "Invalid code");
                        setRecCodeValid(false);
                      }
                    } catch {
                      setRecCodeError("Could not validate code");
                      setRecCodeValid(false);
                    }
                  }}
                  className="border-2 border-comic-ink bg-comic-yellow px-4 py-2 text-sm font-bold text-comic-on-accent transition-colors hover:bg-comic-yellow/80 disabled:opacity-50"
                >
                  Verify
                </button>
              </div>
              {recCodeValid === true && (
                <p className="mt-2 text-xs font-bold text-green-700">Code accepted!</p>
              )}
              {recCodeError && (
                <p className="mt-2 text-xs font-bold text-comic-error">{recCodeError}</p>
              )}
            </div>
          )}

          <div className="border-3 border-comic-ink bg-comic-panel p-6 shadow-comic">
            <h2 className="font-display text-lg font-bold text-comic-ink">
              Order Notes
            </h2>
            <textarea
              value={form.note}
              onChange={(e) => updateField("note", e.target.value)}
              rows={3}
              className="mt-4 w-full border-2 border-comic-ink px-4 py-2 text-sm font-bold text-comic-ink outline-none transition-colors focus:border-comic-cyan"
              placeholder="Any special requests..."
            />
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 border-3 border-comic-ink bg-comic-panel p-6 shadow-comic">
            <h2 className="font-display text-lg font-bold text-comic-ink">
              Order Summary
            </h2>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId ?? ""}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-bold text-comic-ink/80">
                    {item.title}{item.variantLabel ? ` (${item.variantLabel})` : ""} &times; {item.quantity}
                  </span>
                  <span className="font-bold text-comic-ink">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t-2 border-comic-ink pt-4 space-y-2">
              {appliedDiscount && (
                <div className="flex items-center justify-between text-sm font-bold text-green-700">
                  <span>Discount ({appliedDiscount.code})</span>
                  <span>-{formatPrice(appliedDiscount.discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-comic-ink">Total</span>
                <span className="border-2 border-comic-ink bg-comic-yellow px-2 py-0.5 text-comic-on-accent">
                  {formatPrice(
                    Math.max(
                      totalPrice() - (appliedDiscount?.discountAmount ?? 0),
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>

            {/* Discount code input */}
            <div className="mt-4 border-t-2 border-comic-ink pt-4">
              {appliedDiscount ? (
                <div className="flex items-center justify-between border-2 border-green-600 bg-green-50 px-3 py-2">
                  <span className="text-sm font-bold text-green-700">
                    {appliedDiscount.code} applied!
                  </span>
                  <button
                    type="button"
                    onClick={removeDiscount}
                    className="text-xs font-bold text-green-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-bold text-comic-ink/60">
                    Discount Code
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) =>
                        setDiscountInput(e.target.value.toUpperCase())
                      }
                      placeholder="SAVE10"
                      className="flex-1 border-2 border-comic-ink px-3 py-1.5 text-sm font-bold uppercase text-comic-ink outline-none focus:border-comic-cyan"
                    />
                    <button
                      type="button"
                      onClick={applyDiscount}
                      disabled={discountLoading || !discountInput.trim()}
                      className="border-2 border-comic-ink bg-comic-yellow px-3 py-1.5 text-sm font-bold text-comic-on-accent transition-colors hover:bg-comic-yellow/80 disabled:opacity-50"
                    >
                      {discountLoading ? "..." : "Apply"}
                    </button>
                  </div>
                  {discountError && (
                    <p className="mt-1 text-xs font-bold text-comic-error">
                      {discountError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="mt-4 border-2 border-comic-error bg-comic-error/10 p-3 text-sm font-bold text-comic-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full cursor-pointer border-3 border-comic-ink bg-comic-red py-3 font-display text-base font-bold text-comic-on-primary shadow-comic transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-comic-pressed disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0"
            >
              {loading ? "Processing..." : "Place Order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-comic-ink/70">
        {label}
        {required && <span className="text-comic-error"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        className="w-full border-2 border-comic-ink px-4 py-2 text-sm font-bold text-comic-ink outline-none transition-colors focus:border-comic-cyan"
      />
    </div>
  );
}
