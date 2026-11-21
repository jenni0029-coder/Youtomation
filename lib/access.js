// Optional access control + basic abuse protection for the API routes.
//
// ACCESS_CODES      comma-separated list of codes customers receive after purchase.
//                   When unset, the app is open to anyone (fine for local dev only).
// OWNER_CODE        the owner's personal code: always valid, never rate limited.
//                   Setting it alone also turns access control on.
// LEMONSQUEEZY_STORE_ID  when set, Lemon Squeezy license keys from that store are
//                   accepted as access codes. Lemon Squeezy emails the key to the
//                   buyer automatically and expires it when a subscription ends.
// RATE_LIMIT_PER_HOUR  max generations per code (or per IP when open). Default 40.
import { timingSafeEqual, createHash } from "node:crypto";

const codes = (process.env.ACCESS_CODES || "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

const ownerCode = (process.env.OWNER_CODE || "").trim();

const lsStoreId = (process.env.LEMONSQUEEZY_STORE_ID || "").trim();

export const accessRequired = codes.length > 0 || Boolean(ownerCode) || Boolean(lsStoreId);

function digest(s) {
  return createHash("sha256").update(String(s)).digest();
}

export function isOwnerCode(code) {
  if (!ownerCode || !code) return false;
  return timingSafeEqual(digest(ownerCode), digest(code.trim()));
}

export function isValidCode(code) {
  if (!accessRequired) return true;
  if (!code) return false;
  if (isOwnerCode(code)) return true;
  const d = digest(code.trim());
  return codes.some((c) => timingSafeEqual(digest(c), d));
}

// Lemon Squeezy license check (public License API, no API key needed).
// Results are cached per instance so we don't call the API on every generation.
const lsCache = new Map(); // digest -> { ok, until }
const LS_OK_TTL = 10 * 60 * 1000;
const LS_BAD_TTL = 60 * 1000;

async function isValidLicense(code) {
  if (!lsStoreId || !code) return false;
  const key = digest(code.trim()).toString("hex");
  const hit = lsCache.get(key);
  if (hit && hit.until > Date.now()) return hit.ok;
  let ok = false;
  try {
    const res = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ license_key: code.trim() }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    ok =
      data.valid === true &&
      data.license_key?.status === "active" &&
      String(data.meta?.store_id) === lsStoreId;
  } catch {
    // Network problem: honour a previous success rather than locking a paying user out.
    if (hit?.ok) return true;
    return false;
  }
  lsCache.set(key, { ok, until: Date.now() + (ok ? LS_OK_TTL : LS_BAD_TTL) });
  if (lsCache.size > 5000) for (const [k, v] of lsCache) if (v.until < Date.now()) lsCache.delete(k);
  return ok;
}

// Full check: owner code, static ACCESS_CODES, then Lemon Squeezy license keys.
export async function checkCode(code) {
  if (isValidCode(code)) return true;
  return isValidLicense(code);
}

// In-memory sliding window. Per server instance only — for multi-instance
// deployments put this in a shared store (e.g. Upstash Redis / Vercel KV).
const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR) || 40;
const WINDOW = 60 * 60 * 1000;
const hits = new Map();

export function rateLimit(key) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW);
  if (list.length >= LIMIT) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.ceil((WINDOW - (now - list[0])) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > WINDOW) hits.delete(k);
  }
  return { ok: true, remaining: LIMIT - list.length };
}

export function clientKey(request, code) {
  if (accessRequired && code) return "code:" + digest(code).toString("hex").slice(0, 16);
  const fwd = request.headers.get("x-forwarded-for") || "";
  return "ip:" + (fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown");
}
