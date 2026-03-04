"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const order = searchParams.get("order");
  const recCode = searchParams.get("recCode");
  const [copied, setCopied] = useState(false);

  function copyRecCode() {
    if (!recCode) return;
    navigator.clipboard.writeText(recCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center border-3 border-comic-ink bg-comic-cyan shadow-comic">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-comic-on-secondary"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold text-comic-ink">
        Order Confirmed!
      </h1>
      {order && (
        <p className="mt-2 text-lg font-bold text-comic-ink/70">
          Order number: <span className="border-2 border-comic-ink bg-comic-yellow px-2 py-0.5 text-comic-on-accent">{order}</span>
        </p>
      )}
      <p className="mt-4 font-bold text-comic-ink/60">
        Thank you for your purchase! We&apos;ll get your order ready as soon as
        possible.
      </p>

      {recCode && (
        <div className="mx-auto mt-8 max-w-sm border-3 border-comic-ink bg-comic-panel p-6 shadow-comic">
          <p className="text-sm font-bold text-comic-ink/70">
            Share the love! Your recommendation code:
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="border-2 border-comic-ink bg-comic-yellow px-4 py-2 font-display text-xl font-bold tracking-wider text-comic-on-accent">
              {recCode}
            </span>
            <button
              type="button"
              onClick={copyRecCode}
              className="cursor-pointer border-2 border-comic-ink bg-comic-cyan px-3 py-2 text-sm font-bold text-comic-on-secondary transition-colors hover:bg-comic-cyan-dark"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-xs font-bold text-comic-ink/50">
            Share this code with friends so they can use it at checkout.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        {order && (
          <Link
            href={`/orders/track?order=${order}`}
            className="inline-block border-3 border-comic-ink bg-comic-cyan px-8 py-3 font-display text-base font-bold text-comic-on-secondary shadow-comic transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover"
          >
            Track Your Order
          </Link>
        )}
        <Link
          href="/products"
          className="inline-block border-3 border-comic-ink bg-comic-red px-8 py-3 font-display text-base font-bold text-comic-on-primary shadow-comic transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-comic-hover"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
