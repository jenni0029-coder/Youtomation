"use client";

import { useState } from "react";

const FEATURES = [
  "All 10 AI tools",
  "Unlimited niches, 12 output languages",
  "YouTube video & competitor analysis",
  "Saved library + downloads",
  "Works on phone, tablet & desktop",
];

export default function Pricing({ monthly, annual, monthlyUrl, annualUrl, paystack, currency = "$" }) {
  const [plan, setPlan] = useState("annual");
  const [email, setEmail] = useState("");
  const [askEmail, setAskEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    if (!askEmail) return setAskEmail(true);
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, plan }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(data.error || "Couldn't start checkout. Please try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    }
    setBusy(false);
  }
  const m = Number(monthly);
  const a = Number(annual);
  const savePct = m && a ? Math.round((1 - a / (m * 12)) * 100) : 0;
  const isAnnual = plan === "annual";
  const fmt = (n) => currency + (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  const tab = (id, label) => (
    <button
      onClick={() => setPlan(id)}
      aria-pressed={plan === id}
      style={{
        padding: "9px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
        background: plan === id ? "#f1f5f9" : "transparent", color: plan === id ? "#080d1a" : "#94a3b8",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 22 }}>
        {tab("monthly", "Monthly")}
        {tab("annual", "Annual" + (savePct > 0 ? ` · save ${savePct}%` : ""))}
      </div>
      <div className="lp-card" style={{ maxWidth: 420, margin: "0 auto", border: "1.5px solid rgba(0,232,122,0.35)", background: "rgba(0,232,122,0.05)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#00e87a", letterSpacing: 1, textTransform: "uppercase" }}>Creator</div>
        <div style={{ fontSize: 48, fontWeight: 900, margin: "8px 0 2px" }}>
          {isAnnual ? fmt(Math.round((a / 12) * 100) / 100) : fmt(m)}
          <span style={{ fontSize: 16, color: "#94a3b8", fontWeight: 700 }}> /month</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
          {isAnnual ? `Billed ${fmt(a)} once a year` : "Billed monthly · cancel anytime"}
        </div>
        <ul style={{ listStyle: "none", textAlign: "left", display: "flex", flexDirection: "column", gap: 9, marginBottom: 24, fontSize: 14, color: "#cbd5e1" }}>
          {FEATURES.map((f) => <li key={f}>✓ &nbsp;{f}</li>)}
        </ul>
        {paystack ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {askEmail && (
              <input
                type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && email && checkout()}
                placeholder="Your email (your receipt goes here)"
                style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#f1f5f9", fontSize: 16, outline: "none" }}
              />
            )}
            <button onClick={checkout} disabled={busy || (askEmail && !email)} className="lp-btn lp-btn-primary" style={{ display: "block", width: "100%", border: "none", cursor: busy ? "wait" : "pointer", opacity: askEmail && !email ? 0.6 : 1 }}>
              {busy ? "Opening secure checkout…" : askEmail ? "Continue to payment →" : isAnnual ? `Get annual access — ${fmt(a)}/yr` : `Get monthly access — ${fmt(m)}/mo`}
            </button>
            {error && <div role="alert" style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>}
            <div style={{ color: "#64748b", fontSize: 12 }}>Secure payment by Paystack · Visa, Mastercard, Verve & more</div>
          </div>
        ) : (
          <a href={isAnnual ? annualUrl : monthlyUrl} className="lp-btn lp-btn-primary" style={{ display: "block" }}>
            {isAnnual ? `Get annual access — ${fmt(a)}/yr` : `Get monthly access — ${fmt(m)}/mo`}
          </a>
        )}
      </div>
    </div>
  );
}
