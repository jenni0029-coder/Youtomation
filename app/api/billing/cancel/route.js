import { parsePaidCode, cancelSubscriptions, paystackEnabled } from "@/lib/paystack";

export const runtime = "nodejs";

// POST (header x-access-code: paid code) -> cancels the subscription renewal.
export async function POST(request) {
  const customerId = paystackEnabled ? parsePaidCode(request.headers.get("x-access-code")) : null;
  if (!customerId) {
    return Response.json({ error: "This access code isn't linked to a subscription. Email support and we'll help." }, { status: 400 });
  }
  try {
    const r = await cancelSubscriptions(customerId);
    console.log(`billing: cancel customer=${customerId} cancelled=${r.cancelled} already=${r.alreadyCancelled}`);
    if (!r.cancelled && !r.alreadyCancelled) return Response.json({ error: "We couldn't find an active subscription to cancel." }, { status: 404 });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("billing cancel failed", e.message);
    return Response.json({ error: "Couldn't cancel right now. Please try again or email support." }, { status: 502 });
  }
}
