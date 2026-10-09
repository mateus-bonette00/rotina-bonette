import { LIMITS } from "rotina-bonette-shared";

type Bucket = {
  fails: number;
  windowStart: number;
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();
const windowMs = LIMITS.pinWindowMinutes * 60 * 1000;

function current(key: string): Bucket {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || (existing.lockedUntil === 0 && now - existing.windowStart > windowMs)) {
    const fresh = { fails: 0, windowStart: now, lockedUntil: 0 };
    buckets.set(key, fresh);
    return fresh;
  }
  return existing;
}

export function pinLockRemaining(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  return Math.max(0, bucket.lockedUntil - Date.now());
}

export function recordPinFailure(key: string): number {
  const bucket = current(key);
  bucket.fails += 1;
  if (bucket.fails >= LIMITS.maxPinAttempts) {
    bucket.lockedUntil = Date.now() + windowMs;
  }
  return bucket.fails;
}

export function clearPinFailures(key: string): void {
  buckets.delete(key);
}

export function resetPinAttempts(): void {
  buckets.clear();
}

export async function pinBackoff(fails: number): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  const wait = Math.min(fails * 400, 2000);
  await new Promise((resolve) => setTimeout(resolve, wait));
}
