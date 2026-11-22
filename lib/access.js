// Optional access control + basic abuse protection for the API routes.
//
// ACCESS_CODES      comma-separated list of codes customers receive after purchase.
//                   When unset, the app is open to anyone (fine for local dev only).
// OWNER_CODE        the owner's personal code: always valid, never rate limited.
//                   Setting it alone also turns access control on.
// PAYSTACK_*        see lib/paystack.js — paid customers get codes automatically.
// RATE_LIMIT_PER_HOUR  max generations per code (or per IP when open). Default 40.
import { timingSafeEqual, createHash } from "node:crypto";
import { paystackEnabled, parsePaidCode, hasActiveSubscription } from "./paystack";

const codes = (process.env.ACCESS_CODES || "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

const ownerCode = (process.env.OWNER_CODE || "").trim();

export const accessRequired = codes.length > 0 || Boolean(ownerCode) || paystackEnabled;

function digest(s) {
  return createHash("sha256").update(String(s)).digest();
}

export function isOwnerCode(code) {
  if (!ownerCode || !code) return false;
  return timingSafeEqual(digest(ownerCode), digest(code.trim()));
}

// Returns true for the owner code, a manual code from ACCESS_CODES, or a paid
// Paystack code whose subscription is still active.
export async function isValidCode(code) {
  if (!accessRequired) return true;
  if (!code) return false;
  if (isOwnerCode(code)) return true;
  const d = digest(code.trim());
  if (codes.some((c) => timingSafeEqual(digest(c), d))) return true;
  const customerId = paystackEnabled ? parsePaidCode(code) : null;
  return customerId ? hasActiveSubscription(customerId) : false;
}

// In-memory sliding window. Per server instance only — for multi-instance
// deployments put this in a shared store (e.g. Upstash Redis / Vercel KV).
const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR) || 40;
const WINDOW = 60 * 60 * 1000;
const hits = new Map();

// weight: heavier tools (e.g. image generation) count as several generations.
export function rateLimit(key, weight = 1) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW);
  if (list.length + weight > LIMIT) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.ceil((WINDOW - (now - list[0])) / 1000) };
  }
  for (let n = 0; n < weight; n++) list.push(now);
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
