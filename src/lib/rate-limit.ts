interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    const filtered = entry.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (filtered.length === 0) {
      store.delete(key);
    } else {
      entry.timestamps = filtered;
    }
  }
}, 5 * 60 * 1000).unref();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };

  // Remove timestamps outside the window
  const windowStart = now - config.windowMs;
  const filtered = entry.timestamps.filter((t) => t > windowStart);

  if (filtered.length >= config.maxRequests) {
    const oldestInWindow = filtered[0];
    const retryAfterSeconds = Math.ceil(
      (oldestInWindow + config.windowMs - now) / 1000,
    );
    store.set(key, { timestamps: filtered });
    return { allowed: false, retryAfterSeconds };
  }

  filtered.push(now);
  store.set(key, { timestamps: filtered });
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}
