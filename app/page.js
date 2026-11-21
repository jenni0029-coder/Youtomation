import Link from "next/link";

const NAME = process.env.NEXT_PUBLIC_APP_NAME || "AutoTubeAI";
const PRICE = process.env.NEXT_PUBLIC_PRICE || "$19";
const PRICE_NOTE = process.env.NEXT_PUBLIC_PRICE_NOTE || "per month · cancel anytime";
const CHECKOUT = process.env.NEXT_PUBLIC_CHECKOUT_URL || "/app";
const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

const FEATURES = [
  ["✍️", "Word-for-word scripts", "Shorts, 10-minute and deep-dive scripts with hooks, B-roll cues and retention-optimised pacing."],
  ["🔥", "Viral titles", "10 high-CTR titles in your niche and style, with character counts so nothing gets truncated."],
  ["🔍", "SEO packs", "Keywords, 15 tags, hashtags and a ready-to-paste description for every upload."],
  ["🖼️", "Thumbnail concepts", "Three thumbnail directions with colour palettes and image-generator prompts."],
  ["▶️", "Video analysis", "Paste any YouTube link. We read the title, description and transcript so you can learn from — and beat — what works."],
  ["🌐", "Competitor research", "Analyse any website or blog and turn it into video ideas that outrank it."],
  ["📄", "Docs to videos", "Turn PDFs, articles and notes into summaries and full video outlines."],
  ["📅", "Content calendars", "Up to four weeks of planned uploads with hooks, keywords and monetisation angles."],
  ["📊", "Growth reports", "Enter your channel stats and get a prioritised 90-day growth plan."],
];

const STEPS = [
  ["1", "Pick a niche", "Six popular faceless niches built in, or type your own."],
  ["2", "Generate", "Scripts, titles, SEO and thumbnails stream in seconds."],
  ["3", "Publish", "Copy or download, then record, edit and upload."],
];

const FAQ = [
  ["Do I need my own AI API key?", "No. Everything runs on our servers — just sign in with your access code."],
  ["Does it work on my phone?", "Yes. It's built mobile-first and installs to your home screen like an app."],
  ["What languages are supported?", "Outputs can be written in 12 languages including Spanish, Portuguese, Hindi, French and German."],
  ["Where is my work saved?", "Every generation is saved to your library on your device. Download anything as a text file."],
  ["Will it guarantee views or income?", "No tool can. AutoTubeAI makes you faster and more consistent — results depend on your content and niche."],
];

export default function Landing() {
  return (
    <div style={{ background: "radial-gradient(1200px 600px at 50% -200px, rgba(0,232,122,0.12), transparent), #080d1a", minHeight: "100vh" }}>
      <header className="lp" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px" }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>AutoTube<span style={{ color: "#00e87a" }}>AI</span></div>
        <Link href="/app" className="lp-btn lp-btn-ghost" style={{ padding: "9px 16px", fontSize: 13 }}>Open app</Link>
      </header>

      <section className="lp" style={{ textAlign: "center", padding: "70px 20px 60px" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 20, background: "rgba(0,232,122,0.1)", border: "1px solid rgba(0,232,122,0.25)", color: "#00e87a", fontSize: 12, fontWeight: 800, marginBottom: 22 }}>
          The all-in-one AI studio for YouTube creators
        </div>
        <h1>Plan, write and optimise<br />YouTube videos <span style={{ background: "linear-gradient(135deg,#00e87a,#38bdf8)", WebkitBackgroundClip: "text", color: "transparent" }}>10× faster</span></h1>
        <p style={{ maxWidth: 620, margin: "20px auto 32px", color: "#94a3b8", fontSize: 18, lineHeight: 1.6 }}>
          {NAME} writes your scripts, titles, SEO and thumbnail ideas, plans your calendar, and breaks down any competitor video — all from your phone.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={CHECKOUT} className="lp-btn lp-btn-primary">Get started — {PRICE}</a>
          <a href="#features" className="lp-btn lp-btn-ghost">See features</a>
        </div>
      </section>

      <section id="features" className="lp" style={{ padding: "40px 20px" }}>
        <h2 style={{ textAlign: "center" }}>Everything a channel needs</h2>
        <div className="lp-grid">
          {FEATURES.map(([icon, title, body]) => (
            <div key={title} className="lp-card">
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{title}</div>
              <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp" style={{ padding: "50px 20px" }}>
        <h2 style={{ textAlign: "center" }}>How it works</h2>
        <div className="lp-grid">
          {STEPS.map(([n, title, body]) => (
            <div key={n} className="lp-card" style={{ textAlign: "center" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#00e87a,#38bdf8)", color: "#04121f", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>{n}</div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
              <div style={{ color: "#94a3b8", fontSize: 14 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="lp" style={{ padding: "50px 20px", textAlign: "center" }}>
        <h2>Simple pricing</h2>
        <div className="lp-card" style={{ maxWidth: 420, margin: "0 auto", border: "1.5px solid rgba(0,232,122,0.35)", background: "rgba(0,232,122,0.05)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#00e87a", letterSpacing: 1, textTransform: "uppercase" }}>Creator</div>
          <div style={{ fontSize: 48, fontWeight: 900, margin: "8px 0 2px" }}>{PRICE}</div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>{PRICE_NOTE}</div>
          <ul style={{ listStyle: "none", textAlign: "left", display: "flex", flexDirection: "column", gap: 9, marginBottom: 24, fontSize: 14, color: "#cbd5e1" }}>
            {["All 10 AI tools", "Unlimited niches, 12 output languages", "YouTube & competitor analysis", "Saved library + downloads", "Works on phone, tablet & desktop"].map((f) => <li key={f}>✓ &nbsp;{f}</li>)}
          </ul>
          <a href={CHECKOUT} className="lp-btn lp-btn-primary" style={{ display: "block" }}>Get access</a>
        </div>
      </section>

      <section className="lp" style={{ padding: "50px 20px", maxWidth: 760 }}>
        <h2 style={{ textAlign: "center" }}>FAQ</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="lp-card" style={{ marginBottom: 10 }}>
            <summary style={{ fontWeight: 800, cursor: "pointer" }}>{q}</summary>
            <p style={{ color: "#94a3b8", marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>{a}</p>
          </details>
        ))}
      </section>

      <footer className="lp" style={{ padding: "40px 20px 50px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
        <div style={{ display: "flex", gap: 18, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <Link href="/app">App</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          {SUPPORT && <a href={"mailto:" + SUPPORT}>Support</a>}
        </div>
        © {new Date().getFullYear()} {NAME}. Not affiliated with YouTube or Google.
      </footer>
    </div>
  );
}
