import { initializeCheckout, paystackEnabled, PLANS, PlanMismatchError } from "@/lib/paystack";

export const runtime = "nodejs";

// POST { email, plan: "monthly" | "annual" } -> { url } (Paystack checkout page)
export async function POST(request) {
  if (!paystackEnabled) return Response.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const { email, plan } = await request.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 200) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (!PLANS[plan]) return Response.json({ error: "Please choose a plan." }, { status: 400 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  try {
    const data = await initializeCheckout({ email: e, plan, callbackUrl: origin + "/api/paystack/callback" });
    return Response.json({ url: data.authorization_url });
  } catch (err) {
    console.error("checkout init failed", err.message);
    if (err instanceof PlanMismatchError) {
      return Response.json({ error: "Checkout is temporarily unavailable while we fix a pricing setting. Please try again later." }, { status: 503 });
    }
    return Response.json({ error: "Couldn't start checkout. Please try again." }, { status: 502 });
  }
}
