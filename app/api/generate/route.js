import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, InputError, TOOLS } from "@/lib/prompts";
import { fetchWebsite, fetchYouTube, htmlToText, SourceError } from "@/lib/sources";
import { accessRequired, isValidCode, isOwnerCode, rateLimit, clientKey } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ANTHROPIC_EFFORT || "medium";
const MAX_PDF_BYTES = 4 * 1024 * 1024; // keeps requests under typical host body limits
const MAX_DOC_CHARS = 150_000;

let client;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function fail(message, status = 400, headers = {}) {
  return Response.json({ error: message }, { status, headers });
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("The server is missing its ANTHROPIC_API_KEY. Add it to your environment variables.", 500);
  }

  const code = request.headers.get("x-access-code") || "";
  if (accessRequired && !isValidCode(code)) return fail("Please enter a valid access code.", 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request.");
  }
  const { tool, input = {} } = body || {};
  if (!TOOLS.includes(tool)) return fail("Unknown tool.");

  // Image tools cost more, so each scene counts as one generation.
  const weight = tool === "stickman" ? Math.min(6, Math.max(1, Number(input.count) || 4)) : 1;
  const limit = isOwnerCode(code) ? { ok: true, remaining: "unlimited" } : rateLimit(clientKey(request, code), weight);
  if (!limit.ok) {
    return fail(`Hourly limit reached. Try again in ${Math.ceil(limit.retryAfter / 60)} min.`, 429, { "retry-after": String(limit.retryAfter) });
  }

  // Gather source material for reader tools.
  let source = {};
  let sourceMeta = null;
  try {
    if (tool === "doc") {
      if (typeof input.pdfBase64 === "string" && input.pdfBase64) {
        if (input.pdfBase64.length * 0.75 > MAX_PDF_BYTES) return fail("PDF is too large (max 4 MB).");
        source.pdfBase64 = input.pdfBase64;
      } else if (typeof input.text === "string" && input.text.trim()) {
        let t = input.isHtml ? htmlToText(input.text) : input.text;
        if (t.length > MAX_DOC_CHARS) t = t.slice(0, MAX_DOC_CHARS) + "\n[Document truncated]";
        source.text = t;
      } else {
        return fail("Please add a document first.");
      }
    } else if (tool === "yt") {
      const r = await fetchYouTube(input.url);
      source.text = r.text;
      sourceMeta = r.meta;
    } else if (tool === "url") {
      const r = await fetchWebsite(String(input.url || ""));
      source.text = r.text;
      sourceMeta = r.meta;
    }
  } catch (e) {
    if (e instanceof SourceError) return fail(e.message, 422);
    console.error("source fetch failed", e);
    return fail("Couldn't load that link. Please check it and try again.", 422);
  }

  let prompt;
  try {
    prompt = buildPrompt(tool, input, source);
  } catch (e) {
    if (e instanceof InputError) return fail(e.message);
    throw e;
  }

  const params = {
    model: MODEL,
    max_tokens: tool === "stickman" ? 64000 : 32000,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.content }],
    output_config: { effort: EFFORT, ...(prompt.schema ? { format: { type: "json_schema", schema: prompt.schema } } : {}) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (t) => controller.enqueue(encoder.encode(t));
      let anthropicStream;
      try {
        anthropicStream = getClient().beta.messages.stream(params, { signal: request.signal });
        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send(event.delta.text);
        }
        const final = await anthropicStream.finalMessage();
        if (final.stop_reason === "refusal") {
          send("\n\n⚠️ This request couldn't be completed. Try rephrasing your topic.");
        } else if (final.stop_reason === "max_tokens") {
          send("\n\n⚠️ Output was cut off because it reached the length limit.");
        }
      } catch (e) {
        if (request.signal.aborted) return controller.close();
        console.error("generation failed", e);
        let msg = "Something went wrong while generating. Please try again.";
        if (e instanceof Anthropic.AuthenticationError) msg = "The server's Anthropic API key is invalid.";
        else if (e instanceof Anthropic.RateLimitError) msg = "The AI service is busy right now. Please try again in a minute.";
        else if (e instanceof Anthropic.APIError && e.status >= 500) msg = "The AI service had a temporary problem. Please try again.";
        send("\n\n⚠️ " + msg);
      }
      controller.close();
    },
  });

  const headers = {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-remaining": String(limit.remaining),
  };
  if (sourceMeta) headers["x-source"] = encodeURIComponent(JSON.stringify(sourceMeta));
  return new Response(stream, { headers });
}
