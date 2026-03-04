export function formatPrice(priceInCents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(priceInCents / 100);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "shipped", "delivered", "completed", "cancelled"],
  confirmed: ["shipped", "delivered", "completed", "cancelled"],
  shipped: ["delivered", "completed", "cancelled"],
  delivered: ["completed", "returned", "cancelled"],
  completed: ["returned"],
  returned: [],
  cancelled: [],
};
