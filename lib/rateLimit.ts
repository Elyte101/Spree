const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout after MAX_ATTEMPTS failures

interface Entry {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const store = new Map<string, Entry>();

// Prevent unbounded growth — sweep stale entries every 5 minutes.
// Entries idle for 2× the window are safe to drop.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.lastAttempt > WINDOW_MS * 2) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000
).unref?.(); // unref() so the interval doesn't block process exit in test/serverless

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until the lockout expires
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (entry?.lockedUntil) {
    if (now < entry.lockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
      };
    }
    store.delete(identifier);
  }

  return { allowed: true };
}

export function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const existing = store.get(identifier);

  let entry: Entry;
  if (!existing || now - existing.lastAttempt > WINDOW_MS) {
    // First attempt or window expired — start fresh
    entry = { count: 1, lastAttempt: now };
  } else {
    entry = { ...existing, count: existing.count + 1, lastAttempt: now };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }

  store.set(identifier, entry);
}

export function clearFailedAttempts(identifier: string): void {
  store.delete(identifier);
}
