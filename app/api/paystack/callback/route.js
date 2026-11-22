import { verifyTransaction, makePaidCode, PLANS, paystackEnabled } from "@/lib/paystack";

export const runtime = "nodejs";

// Paystack redirects here after payment with ?reference=...
// We verify the payment server-side, then hand the customer their access code.
export async function GET(request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  const fail = (why) => Response.redirect(origin + "/?payment=" + why + "#pricing", 303);
  if (!paystackEnabled || !reference) return fail("missing");

  try {
    const tx = await verifyTransaction(reference);
    const planCode = (tx.plan_object && tx.plan_object.plan_code) || (typeof tx.plan === "string" ? tx.plan : tx.plan?.plan_code);
    const ours = Object.values(PLANS).filter(Boolean);
    if (tx.status !== "success" || !tx.customer?.id || (planCode && !ours.includes(planCode))) return fail("failed");
    const code = makePaidCode(tx.customer.id);
    return Response.redirect(origin + "/app#welcome=" + encodeURIComponent(code), 303);
  } catch (e) {
    console.error("paystack verify failed", e.message);
    return fail("error");
  }
}
