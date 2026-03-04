"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

export function DateRangeTabs({ range }: { range: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-1 rounded-lg bg-warm-brown/5 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => router.push(`/admin/analytics?range=${t.value}`)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
            range === t.value
              ? "bg-white text-teal-primary shadow-sm"
              : "text-warm-brown/60 hover:text-warm-brown",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
