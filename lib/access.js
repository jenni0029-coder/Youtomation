// Optional access control + basic abuse protection for the API routes.
//
// ACCESS_CODES      comma-separated list of codes customers receive after purchase.
//                   When unset, the app is open to anyone (fine for local dev only).
// RATE_LIMIT_PER_HOUR  max generations per code (or per IP when open). Default 40.
import { timingSafeEqual, createHash } from "node:crypto";

const codes = (process.env.ACCESS_CODES || "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

export const accessRequired = codes.length > 0;

function digest(s) {
  return createHash("sha256").update(String(s)).digest();
}

export function isValidCode(code) {
  if (!accessRequired) return true;
  if (!code) return false;
  const d = digest(code.trim());
  return codes.some((c) => timingSafeEqual(digest(c), d));
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
