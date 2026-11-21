# AutoTubeAI — AI YouTube Automation Studio

A mobile-first web app (installable PWA) for YouTube creators, plus a sales landing page.

**Tools**
- **Create:** word-for-word scripts (Short / 8–10 min / 15–20 min), 10 viral titles, SEO packs (keywords, tags, hashtags, full description), thumbnail concepts with image prompts, faceless-video production plans
- **Research:** analyse any YouTube video (title, description, tags and transcript fetched server-side), any website / competitor, or any PDF / text document
- **Plan:** 1–4 week content calendars
- **Channel:** enter your own stats → AI growth report
- Library of everything generated (saved on device), copy / download, 12 output languages

## Routes
| Path | What |
|---|---|
| `/` | Landing page with features, pricing, FAQ |
| `/app` | The app (asks for an access code when `ACCESS_CODES` is set) |
| `/terms`, `/privacy` | Legal **templates** — have them reviewed before selling |
| `/api/generate` | Streaming AI endpoint (prompts are built server-side) |
| `/api/access` | Access-code check |

## Run locally
```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

## Deploy (Vercel recommended)
1. Import this repo in Vercel.
2. Add the environment variables from `.env.example` — at minimum `ANTHROPIC_API_KEY` and `ACCESS_CODES`.
3. Deploy. The `/api/generate` route needs a Node runtime with up to 300 s duration (set in the route).

## How to sell it
The simplest setup needs no database:
1. Create a product on Gumroad, Lemon Squeezy or a Stripe Payment Link.
2. Put its URL in `NEXT_PUBLIC_CHECKOUT_URL` and set `NEXT_PUBLIC_PRICE`.
3. Generate access codes, add them to `ACCESS_CODES` (comma-separated) and deliver one per customer in the purchase email. Remove a code to revoke access.

Every generation costs you Anthropic API credit, so **never deploy publicly without `ACCESS_CODES`**. `RATE_LIMIT_PER_HOUR` caps usage per code.

When you outgrow manual codes, the natural next step is real accounts + Stripe subscriptions (e.g. Clerk/Auth.js + Stripe webhooks) and a shared rate-limit store (Upstash Redis / Vercel KV) — the in-memory limiter is per server instance.

## Configuration
See `.env.example`. AI model defaults to `claude-opus-5-5` at `medium` effort; override with `ANTHROPIC_MODEL` / `ANTHROPIC_EFFORT`.

## Notes
- YouTube transcripts are fetched best-effort from public captions; when a video has none, analysis uses its title, description and tags and says so.
- Website fetching blocks private / internal addresses (SSRF protection) and pages that need JavaScript to render may return too little text.
- Not affiliated with YouTube or Google.
