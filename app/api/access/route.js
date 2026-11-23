import { accessRequired, isValidCode, describeCode } from "@/lib/access";

export const runtime = "nodejs";

// GET: does this deployment require an access code?
export async function GET() {
  return Response.json({ required: accessRequired, checkoutUrl: "/#pricing" });
}

// POST { code }: validate a code.
export async function POST(request) {
  const { code } = await request.json().catch(() => ({}));
  const valid = await isValidCode(typeof code === "string" ? code : "");
  if (!valid) console.log("access denied:", describeCode(code));
  return Response.json({ valid }, { status: valid ? 200 : 401 });
}
