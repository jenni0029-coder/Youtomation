// Paystack subscriptions (Nigeria, Ghana, Kenya, South Africa, Côte d'Ivoire).
//
// PAYSTACK_SECRET_KEY      sk_live_... (or sk_test_... while testing)
// PAYSTACK_PLAN_MONTHLY    plan code (PLN_...) of the monthly plan
// PAYSTACK_PLAN_ANNUAL     plan code (PLN_...) of the annual plan
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = process.env.PAYSTACK_API_BASE || "https://api.paystack.co"; // override only for local tests
const SECRET = process.env.PAYSTACK_SECRET_KEY || "";
export const PLANS = {
  monthly: process.env.PAYSTACK_PLAN_MONTHLY || "",
  annual: process.env.PAYSTACK_PLAN_ANNUAL || "",
};
export const paystackEnabled = Boolean(SECRET && (PLANS.monthly || PLANS.annual));

async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    const err = new Error(data.message || `Paystack error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data.data;
}

export async function initializeCheckout({ email, plan, callbackUrl }) {
  const planCode = PLANS[plan];
  if (!planCode) throw new Error("That plan isn't available.");
  // When a plan is given Paystack charges the plan's amount; amount is still sent as a placeholder.
  return api("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({ email, plan: planCode, amount: 100, callback_url: callbackUrl, metadata: { product: "autotubeai", plan } }),
  });
}

export async function verifyTransaction(reference) {
  return api("/transaction/verify/" + encodeURIComponent(reference));
}

// --- Paid access codes ------------------------------------------------------
// A paid code carries the Paystack customer ID and an HMAC, so the server can
// trust it without a database and then check the live subscription status.
const SIGNING = process.env.ACCESS_SIGNING_SECRET || (SECRET ? "atai:" + SECRET : "");

function sig(id) {
  return createHmac("sha256", SIGNING).update("cust:" + id).digest("base64url").replace(/[-_]/g, "").slice(0, 10).toUpperCase();
}

export function makePaidCode(customerId) {
  return "ATAI-P" + Number(customerId).toString(36).toUpperCase() + "-" + sig(customerId);
}

export function parsePaidCode(code) {
  const m = /^ATAI-P([0-9A-Z]+)-([0-9A-Z]{10})$/.exec(String(code || "").trim().toUpperCase());
  if (!m || !SIGNING) return null;
  const id = parseInt(m[1], 36);
  const a = Buffer.from(sig(id)), b = Buffer.from(m[2]);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

// Subscription check with a short cache so each request doesn't hit Paystack.
const cache = new Map(); // customerId -> { ok, at, lastGood }
const FRESH = 10 * 60 * 1000;
const GRACE = 24 * 60 * 60 * 1000;
const VALID = new Set(["active", "non-renewing", "attention"]);

export async function hasActiveSubscription(customerId) {
  const now = Date.now();
  const hit = cache.get(customerId);
  if (hit && now - hit.at < FRESH) return hit.ok;
  try {
    const subs = await api(`/subscription?customer=${customerId}&perPage=50`);
    const ourPlans = new Set(Object.values(PLANS).filter(Boolean));
    const ok = (subs || []).some((s) => {
      if (!VALID.has(s.status)) return false;
      if (ourPlans.size && s.plan && s.plan.plan_code && !ourPlans.has(s.plan.plan_code)) return false;
      // non-renewing stays valid until the paid period ends
      if (s.status === "non-renewing" && s.next_payment_date && new Date(s.next_payment_date).getTime() < now) return false;
      return true;
    });
    cache.set(customerId, { ok, at: now, lastGood: ok ? now : hit?.lastGood || 0 });
    return ok;
  } catch (e) {
    console.error("paystack subscription check failed", e.message);
    // If Paystack is briefly unreachable, keep recently-verified customers working.
    return Boolean(hit && hit.lastGood && now - hit.lastGood < GRACE);
  }
}
