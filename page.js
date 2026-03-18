"use client";

import { useState, useRef } from "react";

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function callClaude(prompt, base64PDF) {
  const content = base64PDF
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64PDF } },
        { type: "text", text: prompt },
      ]
    : [{ type: "text", text: prompt }];

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content }] }),
  });
  const d = await res.json();
  return d.content ? d.content.map((b) => b.text || "").join("") : "Error – check API key.";
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const NICHES = [
  { name: "Finance",    full: "Finance & Investing",   icon: "💰", color: "#00e87a" },
  { name: "True Crime", full: "True Crime / History",  icon: "🔍", color: "#ff6b35" },
  { name: "Self Help",  full: "Self Improvement",      icon: "🧠", color: "#c084fc" },
  { name: "Tech",       full: "Tech Explainers",       icon: "⚡", color: "#38bdf8" },
  { name: "Wellness",   full: "Meditation / Wellness", icon: "🌿", color: "#34d399" },
  { name: "AI",         full: "AI & Future Tech",      icon: "🤖", color: "#f472b6" },
];

const NAV = [
  { id: "home",   icon: "🏠", label: "Home"   },
  { id: "create", icon: "✨", label: "Create" },
  { id: "reader", icon: "📖", label: "Reader" },
  { id: "plan",   icon: "📅", label: "Plan"   },
  { id: "stats",  icon: "📊", label: "Stats"  },
];

const CREATE_TOOLS = [
  { id: "script",    icon: "✍️",  label: "Script",    color: "#00e87a", grad: "linear-gradient(135deg,#00e87a,#38bdf8)" },
  { id: "video",     icon: "🎬",  label: "Video",     color: "#c084fc", grad: "linear-gradient(135deg,#c084fc,#f472b6)" },
  { id: "thumbnail", icon: "🖼️", label: "Thumbs",    color: "#ff6b35", grad: "linear-gradient(135deg,#ff6b35,#f472b6)" },
  { id: "titles",    icon: "🔥",  label: "Titles",    color: "#f59e0b", grad: "linear-gradient(135deg,#f59e0b,#ff6b35)" },
  { id: "seo",       icon: "🔍",  label: "SEO",       color: "#38bdf8", grad: "linear-gradient(135deg,#38bdf8,#c084fc)" },
];

const READER_MODES = [
  { id: "doc", icon: "📄", label: "Document", color: "#a78bfa", grad: "linear-gradient(135deg,#a78bfa,#6366f1)" },
  { id: "yt",  icon: "▶️",  label: "YouTube",  color: "#ff4444", grad: "linear-gradient(135deg,#ff4444,#ff6b35)" },
  { id: "url", icon: "🌐", label: "Website",  color: "#38bdf8", grad: "linear-gradient(135deg,#38bdf8,#00e87a)" },
];

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------
function SectionLabel({ color, children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: color || "#64748b", marginBottom: 7 }}>
      {children}
    </div>
  );
}

function TextInput({ style, ...rest }) {
  return (
    <input
      {...rest}
      style={{
        width: "100%", padding: "12px 14px", borderRadius: 14,
        background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)",
        color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit",
        boxSizing: "border-box", ...style,
      }}
    />
  );
}

function DropdownSelect({ children, ...rest }) {
  return (
    <select
      {...rest}
      style={{
        width: "100%", padding: "12px 14px", borderRadius: 14,
        background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)",
        color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit",
        boxSizing: "border-box", cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

function ActionButton({ onClick, loading, disabled, grad, children }) {
  const inactive = loading || disabled;
  return (
    <button
      onClick={onClick}
      disabled={inactive}
      style={{
        width: "100%", padding: "14px", borderRadius: 16, border: "none",
        background: inactive ? "rgba(255,255,255,0.06)" : grad,
        color: inactive ? "#334155" : "#fff",
        fontWeight: 800, fontSize: 14, cursor: inactive ? "not-allowed" : "pointer",
        marginTop: 12, transition: "all .2s",
        boxShadow: inactive ? "none" : "0 4px 20px rgba(0,0,0,0.45)",
      }}
    >
      {loading ? "⏳ Working…" : children}
    </button>
  );
}

function OutputBox({ text, accent }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div style={{ marginTop: 14, position: "relative" }}>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{
          position: "absolute", top: 10, right: 10, padding: "4px 11px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.5)",
          color: copied ? "#00e87a" : "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer", zIndex: 2,
        }}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <div style={{
        background: "rgba(0,0,0,0.4)", border: "1.5px solid " + (accent || "rgba(255,255,255,0.1)"),
        borderRadius: 18, padding: "16px 14px", maxHeight: 360, overflowY: "auto",
        fontSize: 13, lineHeight: 1.85, color: "#cbd5e1", whiteSpace: "pre-wrap",
      }}>
        {text}
      </div>
    </div>
  );
}

function NichePicker({ value, onChange }) {
  return (
    <div>
      <SectionLabel>Niche</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
        {NICHES.map((n) => (
          <button
            key={n.name}
            onClick={() => onChange(n.name === value ? "" : n.name)}
            style={{
              padding: "10px 6px", borderRadius: 13, cursor: "pointer",
              fontWeight: 700, fontSize: 11, textAlign: "center",
              border: "1.5px solid " + (value === n.name ? n.color : "rgba(255,255,255,0.09)"),
              background: value === n.name ? n.color + "18" : "rgba(255,255,255,0.03)",
              color: value === n.name ? n.color : "#94a3b8",
              transition: "all .18s",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 3 }}>{n.icon}</div>
            {n.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SegmentedPicker({ options, value, onChange, activeColor }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + options.length + ",1fr)", gap: 7 }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding: "9px 6px", borderRadius: 12, cursor: "pointer",
            fontWeight: 700, fontSize: 11,
            border: "1.5px solid " + (value === o.id ? (activeColor || "#00e87a") : "rgba(255,255,255,0.08)"),
            background: value === o.id ? (activeColor || "#00e87a") + "18" : "rgba(255,255,255,0.03)",
            color: value === o.id ? (activeColor || "#00e87a") : "#64748b",
            transition: "all .18s",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CREATE tools
// ---------------------------------------------------------------------------
function ScriptTool() {
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function run() {
    if (!niche || !topic) return;
    setLoading(true); setOutput("");
    const n = NICHES.find((x) => x.name === niche);
    setOutput(await callClaude(
      "Write a complete viral YouTube script for the " + n.full + " niche on: " + topic + "\n\n" +
      "Sections:\nHOOK (0-30s): attention grabber\nINTRO (30-60s): what they will learn\n" +
      "MAIN (3-8 min): 3-5 punchy points with examples\nCTA (30s): like/subscribe/comment\nOUTRO (15s): tease next video\n\n" +
      "Make it conversational, punchy, and retention-optimized."
    ).catch(() => "Error generating script. Check your API key."));
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Video Topic</SectionLabel>
        <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 7 passive income ideas for 2025" onKeyDown={(e) => e.key === "Enter" && run()} />
      </div>
      <ActionButton onClick={run} loading={loading} disabled={!niche || !topic} grad="linear-gradient(135deg,#00e87a,#38bdf8)">
        ✍️ Generate Script
      </ActionButton>
      <OutputBox text={output} accent="rgba(0,232,122,0.25)" />
    </div>
  );
}

function VideoTool() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function run() {
    if (!idea) return;
    setLoading(true); setOutput("");
    setOutput(await callClaude(
      "Create a detailed AI video production plan for: " + idea + "\n\n" +
      "1. Video Style and Format\n2. Voice Direction\n3. B-Roll Shot List (10 scenes)\n" +
      "4. Music Mood\n5. Editing Notes\n6. Shorts Cut Strategy\n7. 10 SEO Tags\n8. Estimated AI Production Time"
    ).catch(() => "Error. Check your API key."));
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <SectionLabel>Video Idea or Title</SectionLabel>
        <TextInput value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. The Dark Truth About Social Media" onKeyDown={(e) => e.key === "Enter" && run()} />
      </div>
      <ActionButton onClick={run} loading={loading} disabled={!idea} grad="linear-gradient(135deg,#c084fc,#f472b6)">
        🎬 Generate Production Plan
      </ActionButton>
      <OutputBox text={output} accent="rgba(192,132,252,0.25)" />
    </div>
  );
}

function ThumbnailTool() {
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function run() {
    if (!title) return;
    setLoading(true); setOutput("");
    const n = NICHES.find((x) => x.name === niche);
    setOutput(await callClaude(
      "Create 3 viral YouTube thumbnail concepts for: " + title + " (" + (n ? n.full : "general") + " niche)\n\n" +
      "For each concept:\nCONCEPT NAME\nLayout\nBackground\nText Overlay\nColor Palette with hex codes\nMidjourney Prompt\nWhy It Works"
    ).catch(() => "Error. Check your API key."));
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <SectionLabel>Video Title</SectionLabel>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter your video title..." />
      </div>
      <NichePicker value={niche} onChange={setNiche} />
      <ActionButton onClick={run} loading={loading} disabled={!title} grad="linear-gradient(135deg,#ff6b35,#f472b6)">
        🖼️ Generate Thumbnails
      </ActionButton>
      <OutputBox text={output} accent="rgba(255,107,53,0.25)" />
    </div>
  );
}

function TitlesTool() {
  const [niche, setNiche] = useState("");
  const [seed, setSeed] = useState("");
  const [style, setStyle] = useState("viral");
  const [loading, setLoading] = useState(false);
  const [titles, setTitles] = useState([]);
  const [copied, setCopied] = useState(null);

  const STYLES = [
    { id: "viral",         label: "🔥 Viral"    },
    { id: "listicle",      label: "📋 List"      },
    { id: "story",         label: "📖 Story"     },
    { id: "controversial", label: "⚡ Hot Take"  },
    { id: "howto",         label: "🛠️ How-To"   },
    { id: "secret",        label: "🔐 Secret"    },
  ];

  async function run() {
    if (!niche) return;
    setLoading(true); setTitles([]);
    try {
      const n = NICHES.find((x) => x.name === niche);
      const raw = await callClaude(
        "Generate 10 YouTube video titles for the " + n.full + " niche.\n" +
        "Style: " + style + ". Topic seed: " + (seed || "any trending topic") + ".\n" +
        "Rules: under 60 characters, high CTR, emotional triggers.\n" +
        "Return ONLY a valid JSON array of strings with no other text: [\"Title 1\",\"Title 2\",...]"
      );
      const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      setTitles(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTitles(["Error parsing titles. Please try again."]);
    }
    setLoading(false);
  }

  function copyTitle(t, i) {
    navigator.clipboard.writeText(t);
    setCopied(i);
    setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Topic Seed (optional)</SectionLabel>
        <TextInput value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. passive income, crypto, habits..." />
      </div>
      <div>
        <SectionLabel>Style</SectionLabel>
        <SegmentedPicker options={STYLES} value={style} onChange={setStyle} activeColor="#f59e0b" />
      </div>
      <ActionButton onClick={run} loading={loading} disabled={!niche} grad="linear-gradient(135deg,#f59e0b,#ff6b35)">
        🔥 Generate 10 Titles
      </ActionButton>
      {titles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
          {titles.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", minWidth: 18 }}>{"#" + (i + 1)}</span>
              <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, lineHeight: 1.4 }}>{t}</span>
              <button onClick={() => copyTitle(t, i)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: copied === i ? "rgba(0,232,122,0.15)" : "rgba(255,255,255,0.05)", color: copied === i ? "#00e87a" : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                {copied === i ? "✓" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SEOTool() {
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(null);

  const compColor = { low: "#00e87a", medium: "#f59e0b", high: "#ff6b35" };

  async function run() {
    if (!niche || !topic) return;
    setLoading(true); setData(null);
    try {
      const n = NICHES.find((x) => x.name === niche);
      const raw = await callClaude(
        "YouTube SEO strategy for the " + n.full + " niche, topic: " + topic + ".\n" +
        "Return ONLY valid JSON with this exact structure, no other text:\n" +
        "{\"primary\":[{\"keyword\":\"...\",\"volume\":\"...\",\"competition\":\"low\",\"cpc\":\"...\"}]," +
        "\"secondary\":[{\"keyword\":\"...\",\"volume\":\"...\",\"competition\":\"medium\",\"cpc\":\"...\"}]," +
        "\"longtail\":[{\"keyword\":\"...\",\"volume\":\"...\",\"competition\":\"low\",\"cpc\":\"...\"}]," +
        "\"tags\":[\"tag1\",\"tag2\"],\"description_opener\":\"...\",\"title_formula\":\"...\"}\n" +
        "primary: 3 items, secondary: 5 items, longtail: 5 items, tags: 10 items"
      );
      const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      setData(JSON.parse(clean));
    } catch {
      setData({ error: true });
    }
    setLoading(false);
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Video Topic</SectionLabel>
        <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. passive income for beginners" onKeyDown={(e) => e.key === "Enter" && run()} />
      </div>
      <ActionButton onClick={run} loading={loading} disabled={!niche || !topic} grad="linear-gradient(135deg,#38bdf8,#c084fc)">
        🔍 Research Keywords
      </ActionButton>

      {data && !data.error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
          {[["🎯 Primary", data.primary, "#00e87a"], ["📌 Secondary", data.secondary, "#38bdf8"], ["🔎 Long-tail", data.longtail, "#c084fc"]].map(([lbl, items, accent]) => (
            <div key={lbl}>
              <SectionLabel color={accent}>{lbl}</SectionLabel>
              {Array.isArray(items) && items.map((kw, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 5 }}>
                  <span style={{ flex: 1, fontSize: 12, color: "#e2e8f0" }}>{kw.keyword}</span>
                  <span style={{ fontSize: 10, color: "#475569" }}>{kw.volume}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: compColor[kw.competition] || "#94a3b8", background: (compColor[kw.competition] || "#94a3b8") + "18", padding: "2px 7px", borderRadius: 20 }}>{kw.competition}</span>
                  <span style={{ fontSize: 10, color: "#34d399", fontFamily: "monospace" }}>{kw.cpc}</span>
                </div>
              ))}
            </div>
          ))}

          {Array.isArray(data.tags) && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <SectionLabel>🏷️ Tags</SectionLabel>
                <button onClick={() => copyText(data.tags.join(", "), "tags")} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: copied === "tags" ? "rgba(0,232,122,0.15)" : "rgba(255,255,255,0.05)", color: copied === "tags" ? "#00e87a" : "#64748b", cursor: "pointer" }}>
                  {copied === "tags" ? "✓ Copied" : "Copy All"}
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.tags.map((t, i) => <span key={i} style={{ padding: "5px 11px", background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.2)", borderRadius: 20, fontSize: 11, color: "#f472b6" }}>{t}</span>)}
              </div>
            </div>
          )}

          {data.title_formula && (
            <div style={{ padding: "12px 14px", background: "rgba(0,232,122,0.07)", border: "1.5px solid rgba(0,232,122,0.2)", borderRadius: 14 }}>
              <SectionLabel color="#00e87a">🏆 Best Title Formula</SectionLabel>
              <div style={{ fontSize: 13, color: "#e2e8f0" }}>{data.title_formula}</div>
            </div>
          )}

          {data.description_opener && (
            <div style={{ padding: "12px 14px", background: "rgba(56,189,248,0.07)", border: "1.5px solid rgba(56,189,248,0.2)", borderRadius: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <SectionLabel color="#38bdf8">📝 Description Opener</SectionLabel>
                <button onClick={() => copyText(data.description_opener, "desc")} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: copied === "desc" ? "rgba(0,232,122,0.15)" : "rgba(255,255,255,0.05)", color: copied === "desc" ? "#00e87a" : "#64748b", cursor: "pointer" }}>
                  {copied === "desc" ? "✓" : "Copy"}
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{data.description_opener}</div>
            </div>
          )}
        </div>
      )}
      {data && data.error && <div style={{ color: "#ff6b35", fontSize: 13, padding: 12 }}>Parse error – please try again.</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// READER tools
// ---------------------------------------------------------------------------
function DocReader() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("summarize");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const ACTIONS = [
    { id: "summarize", label: "📋 Summarize"     },
    { id: "explain",   label: "🧠 Explain Simply" },
    { id: "keypoints", label: "🎯 Key Points"     },
    { id: "ask",       label: "❓ Ask"            },
  ];

  function handleFile(f) {
    if (f && (f.type === "application/pdf" || f.type.startsWith("text/"))) setFile(f);
  }

  async function run() {
    if (!file) return;
    setLoading(true); setOutput("");
    try {
      const prompts = {
        summarize: "Provide a clear structured summary: main topic, key arguments, conclusions.",
        explain:   "Explain in plain simple English for someone with no background in this topic.",
        keypoints: "List the most important key points as a numbered list.",
        ask:       question || "What is this document about?",
      };
      const prompt = prompts[mode];

      if (file.type === "application/pdf") {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = () => rej(new Error("read failed"));
          r.readAsDataURL(file);
        });
        setOutput(await callClaude(prompt, b64));
      } else {
        const text = await file.text();
        setOutput(await callClaude("Document content:\n\n" + text + "\n\n" + prompt));
      }
    } catch {
      setOutput("Error reading file. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current && fileRef.current.click()}
        style={{ border: "2px dashed " + (dragging ? "#a78bfa" : file ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"), borderRadius: 18, padding: "26px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "rgba(167,139,250,0.08)" : file ? "rgba(167,139,250,0.05)" : "rgba(255,255,255,0.02)", transition: "all .2s" }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv" onChange={(e) => handleFile(e.target.files[0])} style={{ display: "none" }} />
        {file ? (
          <div>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>{file.name}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{(file.size / 1024).toFixed(1)} KB · tap to change</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>Drop file here</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 3 }}>PDF, TXT, MD, CSV</div>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>What do you want?</SectionLabel>
        <SegmentedPicker options={ACTIONS} value={mode} onChange={setMode} activeColor="#a78bfa" />
      </div>

      {mode === "ask" && (
        <div>
          <SectionLabel>Your Question</SectionLabel>
          <TextInput value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What are the main risks mentioned?" onKeyDown={(e) => e.key === "Enter" && run()} />
        </div>
      )}

      <ActionButton onClick={run} loading={loading} disabled={!file} grad="linear-gradient(135deg,#a78bfa,#6366f1)">
        📄 Read Document
      </ActionButton>
      <OutputBox text={output} accent="rgba(167,139,250,0.3)" />
    </div>
  );
}

function YouTubeReader() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("summarize");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const ACTIONS = [
    { id: "summarize", label: "📋 Summarize"  },
    { id: "keypoints", label: "🎯 Takeaways"  },
    { id: "script",    label: "✍️ Script Ideas" },
    { id: "ask",       label: "❓ Ask"         },
  ];

  function getVideoId(u) {
    const m = u.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  const videoId = getVideoId(url);

  async function run() {
    if (!url) return;
    setLoading(true); setOutput("");
    const prompts = {
      summarize: "Analyze this YouTube video: " + url + "\n1. What it is about\n2. Main points covered\n3. Key insights\n4. Content style and format\n5. Target audience",
      keypoints: "For this YouTube video: " + url + "\nTop 5-7 key takeaways, actionable tips, main argument, why it is valuable",
      script:    "Based on: " + url + "\n1. Three similar title ideas\n2. Script outline for a similar video\n3. Key talking points\n4. Hook ideas for first 30 seconds\n5. Thumbnail concept suggestions",
      ask:       "Regarding: " + url + "\nQuestion: " + (question || "What is this video about and who is it for?"),
    };
    setOutput(await callClaude(prompts[mode]).catch(() => "Error. Please check the URL and try again."));
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <SectionLabel>YouTube URL</SectionLabel>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={{ borderColor: videoId ? "rgba(255,68,68,0.4)" : "rgba(255,255,255,0.1)" }} />
      </div>

      {videoId && (
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid rgba(255,68,68,0.3)", position: "relative" }}>
          <img src={"https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg"} alt="Video thumbnail" style={{ width: "100%", display: "block" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(transparent,rgba(0,0,0,0.7))" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>✓ Video detected</span>
          </div>
        </div>
      )}

      <div>
        <SectionLabel>What do you want?</SectionLabel>
        <SegmentedPicker options={ACTIONS} value={mode} onChange={setMode} activeColor="#ff4444" />
      </div>

      {mode === "ask" && (
        <div>
          <SectionLabel>Your Question</SectionLabel>
          <TextInput value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What strategy does this creator use?" onKeyDown={(e) => e.key === "Enter" && run()} />
        </div>
      )}

      <ActionButton onClick={run} loading={loading} disabled={!url} grad="linear-gradient(135deg,#ff4444,#ff6b35)">
        ▶️ Analyze Video
      </ActionButton>
      <OutputBox text={output} accent="rgba(255,68,68,0.3)" />
    </div>
  );
}

function WebsiteReader() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("summarize");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const ACTIONS = [
    { id: "summarize",  label: "📋 Summarize"  },
    { id: "keypoints",  label: "🎯 Key Points"  },
    { id: "competitor", label: "🔍 Competitor"  },
    { id: "ask",        label: "❓ Ask"          },
  ];

  const isValid = url.length > 5;

  async function run() {
    if (!isValid) return;
    setLoading(true); setOutput("");
    const u = url.startsWith("http") ? url : "https://" + url;
    const prompts = {
      summarize:  "Analyze this website: " + u + "\n1. What it is about\n2. Main message\n3. Target audience\n4. Key information\n5. Quality assessment",
      keypoints:  "Website: " + u + "\nTop 5-7 key points, important info, calls to action, unique value proposition",
      competitor: "Competitor analysis: " + u + "\n1. What they do\n2. Strengths\n3. Weaknesses\n4. Monetization strategy\n5. Content and SEO strategy\n6. How to compete against them\n7. What you can do better",
      ask:        "Website: " + u + "\nQuestion: " + (question || "What is this website about?"),
    };
    setOutput(await callClaude(prompts[mode]).catch(() => "Error. Please check the URL and try again."));
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <SectionLabel>Website URL</SectionLabel>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" onKeyDown={(e) => e.key === "Enter" && run()} style={{ borderColor: isValid ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.1)" }} />
      </div>

      <div>
        <SectionLabel color="#334155">Quick Examples</SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {["youtube.com", "netflix.com", "amazon.com"].map((s) => (
            <button key={s} onClick={() => setUrl("https://" + s)} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(56,189,248,0.2)", background: "rgba(56,189,248,0.07)", color: "#38bdf8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>What do you want?</SectionLabel>
        <SegmentedPicker options={ACTIONS} value={mode} onChange={setMode} activeColor="#38bdf8" />
      </div>

      {mode === "ask" && (
        <div>
          <SectionLabel>Your Question</SectionLabel>
          <TextInput value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What products do they sell?" onKeyDown={(e) => e.key === "Enter" && run()} />
        </div>
      )}

      <ActionButton onClick={run} loading={loading} disabled={!isValid} grad="linear-gradient(135deg,#38bdf8,#00e87a)">
        🌐 Analyze Website
      </ActionButton>
      <OutputBox text={output} accent="rgba(56,189,248,0.3)" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PLAN screen
// ---------------------------------------------------------------------------
function PlanScreen() {
  const [niche, setNiche] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function run() {
    if (!niche) return;
    setLoading(true); setOutput("");
    const n = NICHES.find((x) => x.name === niche);
    setOutput(await callClaude(
      "Create a " + (weeks * 7) + "-video content calendar for a " + n.full + " YouTube automation channel.\n\n" +
      "For each video provide:\nDay number and day name\nTitle\nHook (first 5 seconds)\nKeywords: 3 targets\nBest Upload Time\nEstimated Views in 30 days\nMonetization angle\n\n" +
      "Mix evergreen and trending content. Optimize for algorithm growth."
    ).catch(() => "Error. Check your API key."));
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Weeks to Plan</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
          {[1, 2, 3, 4].map((w) => (
            <button key={w} onClick={() => setWeeks(w)} style={{ padding: "12px 6px", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 12, border: "1.5px solid " + (weeks === w ? "#34d399" : "rgba(255,255,255,0.09)"), background: weeks === w ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.03)", color: weeks === w ? "#34d399" : "#94a3b8", transition: "all .18s" }}>
              {w}W
              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{w * 7} vids</div>
            </button>
          ))}
        </div>
      </div>
      <ActionButton onClick={run} loading={loading} disabled={!niche} grad="linear-gradient(135deg,#34d399,#38bdf8)">
        📅 Generate Calendar
      </ActionButton>
      <OutputBox text={output} accent="rgba(52,211,153,0.25)" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// STATS screen
// ---------------------------------------------------------------------------
function StatsScreen() {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const STATS = [
    { label: "Subscribers", value: "4,820",  color: "#00e87a" },
    { label: "Monthly Views", value: "312K", color: "#38bdf8" },
    { label: "Revenue",       value: "$847", color: "#c084fc" },
    { label: "Avg CPM",    value: "$18.40",  color: "#f472b6" },
  ];

  async function run() {
    setLoading(true); setOutput("");
    setOutput(await callClaude(
      "Analyze this YouTube automation channel and give a detailed growth report:\n\n" +
      "Subscribers: 4,820 | Monthly Views: 312K | Revenue: $847/month\n" +
      "Niche: Finance and Self Help | Daily uploads | Avg Watch Time: 4.2 min | CTR: 6.8%\n\n" +
      "Top Videos:\n- 7 Money Habits: 142K views, $284\n- AI Revolution: 89K views, $198\n- 99% Stay Broke: 310K views, $621\n\n" +
      "Provide:\n1. What is Working\n2. Red Flags to Address\n3. Top 5 Growth Actions\n4. Revenue Optimization Strategies\n5. 90-Day Target and How to Hit It\n6. 12-Month Revenue Projection"
    ).catch(() => "Error. Check your API key."));
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {STATS.map((s) => (
          <div key={s.label} style={{ padding: "16px", background: "rgba(255,255,255,0.04)", border: "1.5px solid " + s.color + "22", borderRadius: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: "ui-monospace,monospace", marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <ActionButton onClick={run} loading={loading} disabled={false} grad="linear-gradient(135deg,#c084fc,#38bdf8)">
        📊 AI Channel Analysis
      </ActionButton>
      <OutputBox text={output} accent="rgba(192,132,252,0.25)" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HOME screen
// ---------------------------------------------------------------------------
function HomeScreen({ onNav }) {
  const QUICK = [
    { icon: "✍️", label: "Write Script",   sub: "AI script generator",  sec: "create", sub2: "script",    color: "#00e87a" },
    { icon: "🔥", label: "Viral Titles",   sub: "10 title ideas fast",  sec: "create", sub2: "titles",    color: "#f59e0b" },
    { icon: "📄", label: "Read Document",  sub: "PDF and file analyser",sec: "reader", sub2: "doc",       color: "#a78bfa" },
    { icon: "▶️",  label: "YouTube Read",  sub: "Analyze any video",    sec: "reader", sub2: "yt",        color: "#ff4444" },
    { icon: "🔍", label: "SEO Keywords",   sub: "Rank on YouTube",      sec: "create", sub2: "seo",       color: "#38bdf8" },
    { icon: "🌐", label: "Website Read",   sub: "Competitor research",  sec: "reader", sub2: "url",       color: "#34d399" },
  ];

  return (
    <div style={{ animation: "fadeUp .35s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 22 }}>
        {[["💰", "$847", "Revenue"], ["🎬", "23", "Videos"], ["👁", "595K", "Views"]].map(([icon, v, l]) => (
          <div key={l} style={{ padding: "13px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, textAlign: "center" }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", fontFamily: "ui-monospace,monospace", marginTop: 2 }}>{v}</div>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{l}</div>
          </div>
        ))}
      </div>

      <SectionLabel>Quick Actions</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 20 }}>
        {QUICK.map((item, i) => (
          <button key={i} onClick={() => onNav(item.sec, item.sub2)} style={{ padding: "16px 14px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", textAlign: "left", cursor: "pointer", animation: "fadeUp " + (0.15 + i * 0.07) + "s ease", transition: "border-color .2s" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{item.sub}</div>
            <div style={{ height: 2, borderRadius: 2, background: "linear-gradient(90deg," + item.color + ",transparent)", marginTop: 8, opacity: 0.6 }} />
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 16px", background: "rgba(0,232,122,0.07)", border: "1.5px solid rgba(0,232,122,0.15)", borderRadius: 18, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 22 }}>📱</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#00e87a", marginBottom: 3 }}>Save to Home Screen</div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
            <strong style={{ color: "#94a3b8" }}>iPhone:</strong> Tap Share then Add to Home Screen<br />
            <strong style={{ color: "#94a3b8" }}>Android:</strong> Tap menu then Add to Home Screen
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROOT APP
// ---------------------------------------------------------------------------
export default function App() {
  const [section, setSection] = useState("home");
  const [createTool, setCreateTool] = useState("script");
  const [readerMode, setReaderMode] = useState("doc");

  function handleNav(sec, sub) {
    setSection(sec);
    if (sec === "create" && sub) setCreateTool(sub);
    if (sec === "reader" && sub) setReaderMode(sub);
  }

  const activeSec = NAV.find((s) => s.id === section);

  const createMap = {
    script:    <ScriptTool />,
    video:     <VideoTool />,
    thumbnail: <ThumbnailTool />,
    titles:    <TitlesTool />,
    seo:       <SEOTool />,
  };

  const readerMap = {
    doc: <DocReader />,
    yt:  <YouTubeReader />,
    url: <WebsiteReader />,
  };

  return (
    <div style={{ minHeight: "100vh", maxWidth: 430, margin: "0 auto", background: "#080d1a", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#f1f5f9", display: "flex", flexDirection: "column" }}>

      <div style={{ height: "env(safe-area-inset-top,0px)", background: "#080d1a" }} />

      {/* Header */}
      <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,13,26,0.97)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: section === "create" || section === "reader" ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.5 }}>
              AutoTube<span style={{ color: "#00e87a" }}>AI</span>
              {section !== "home" && <span style={{ color: "#334155" }}> / </span>}
              {section !== "home" && <span style={{ fontSize: 16, color: section === "reader" ? "#a78bfa" : section === "plan" ? "#34d399" : section === "stats" ? "#c084fc" : "#00e87a" }}>{activeSec ? activeSec.label : ""}</span>}
            </div>
            <div style={{ fontSize: 10, color: "#334155", fontWeight: 600 }}>YouTube Automation System</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00e87a", boxShadow: "0 0 8px #00e87a", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#00e87a", fontWeight: 800 }}>LIVE</span>
          </div>
        </div>

        {section === "create" && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {CREATE_TOOLS.map((t) => (
              <button key={t.id} onClick={() => setCreateTool(t.id)} style={{ padding: "7px 13px", borderRadius: 20, border: "1.5px solid " + (createTool === t.id ? t.color : "rgba(255,255,255,0.08)"), background: createTool === t.id ? t.color + "18" : "rgba(255,255,255,0.03)", color: createTool === t.id ? t.color : "#475569", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all .18s" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        {section === "reader" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
            {READER_MODES.map((m) => (
              <button key={m.id} onClick={() => setReaderMode(m.id)} style={{ padding: "9px 8px", borderRadius: 13, cursor: "pointer", fontWeight: 700, fontSize: 11, textAlign: "center", border: "1.5px solid " + (readerMode === m.id ? m.color : "rgba(255,255,255,0.07)"), background: readerMode === m.id ? m.color + "18" : "rgba(255,255,255,0.03)", color: readerMode === m.id ? m.color : "#475569", transition: "all .2s" }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "18px 18px 100px", overflowY: "auto" }}>
        {section === "home"   && <HomeScreen onNav={handleNav} />}
        {section === "create" && <div style={{ animation: "fadeUp .25s ease" }} key={createTool}>{createMap[createTool]}</div>}
        {section === "reader" && <div style={{ animation: "fadeUp .25s ease" }} key={readerMode}>{readerMap[readerMode]}</div>}
        {section === "plan"   && <div style={{ animation: "fadeUp .25s ease" }}><PlanScreen /></div>}
        {section === "stats"  && <div style={{ animation: "fadeUp .25s ease" }}><StatsScreen /></div>}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, paddingBottom: "calc(8px + env(safe-area-inset-bottom,0px))", background: "rgba(8,13,26,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)" }}>
          {NAV.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{ padding: "10px 4px 8px", border: "none", background: "transparent", cursor: "pointer", textAlign: "center", transition: "all .18s" }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 700, marginTop: 3, letterSpacing: 0.3, color: section === s.id ? "#00e87a" : "#334155" }}>{s.label}</div>
              {section === s.id && <div style={{ width: 16, height: 2, borderRadius: 2, background: "#00e87a", margin: "4px auto 0" }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
