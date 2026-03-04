import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/admin/sparkline";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  className?: string;
}

export function StatCard({ label, value, sub, sparklineData, sparklineColor, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl bg-white p-4 shadow-sm", className)}>
      <p className="text-sm text-warm-brown/60">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-warm-brown">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-warm-brown/50">{sub}</p>}
      {sparklineData && sparklineData.length >= 2 && (
        <Sparkline data={sparklineData} color={sparklineColor} className="mt-2 h-6 w-full" />
      )}
    </div>
  );
}
