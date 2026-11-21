import { accessRequired, isValidCode } from "@/lib/access";

export const runtime = "nodejs";

// GET: does this deployment require an access code?
export async function GET() {
  return Response.json({ required: accessRequired, checkoutUrl: process.env.NEXT_PUBLIC_CHECKOUT_URL || null });
}

// POST { code }: validate a code.
export async function POST(request) {
  const { code } = await request.json().catch(() => ({}));
  const valid = isValidCode(typeof code === "string" ? code : "");
  return Response.json({ valid }, { status: valid ? 200 : 401 });
}
