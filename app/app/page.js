"use client";

import { useEffect, useRef, useState } from "react";
import { runTool, parseJsonOutput, downloadText, copyText, slug, store } from "@/lib/client";
import { sanitizeSvg } from "@/lib/svg";

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const NICHES = [
  { name: "Finance",    icon: "💰", color: "#00e87a" },
  { name: "True Crime", icon: "🔍", color: "#ff6b35" },
  { name: "Self Help",  icon: "🧠", color: "#c084fc" },
  { name: "Tech",       icon: "⚡", color: "#38bdf8" },
  { name: "Wellness",   icon: "🌿", color: "#34d399" },
  { name: "AI",         icon: "🤖", color: "#f472b6" },
];

const LANGUAGES = ["English", "Spanish", "Portuguese", "French", "German", "Italian", "Hindi", "Indonesian", "Japanese", "Korean", "Arabic", "Turkish"];

const NAV = [
  { id: "home",   icon: "🏠", label: "Home"   },
  { id: "create", icon: "✨", label: "Create" },
  { id: "reader", icon: "📖", label: "Research" },
  { id: "plan",   icon: "📅", label: "Plan"   },
  { id: "stats",  icon: "📊", label: "Channel" },
];

const CREATE_TOOLS = [
  { id: "stickman",  icon: "🧍",  label: "Stickman", color: "#e2e8f0" },
  { id: "script",    icon: "✍️",  label: "Script",  color: "#00e87a" },
  { id: "titles",    icon: "🔥",  label: "Titles",  color: "#f59e0b" },
  { id: "seo",       icon: "🔍",  label: "SEO",     color: "#38bdf8" },
  { id: "thumbnail", icon: "🖼️", label: "Thumbs",  color: "#ff6b35" },
  { id: "video",     icon: "🎬",  label: "Production", color: "#c084fc" },
];

const READER_MODES = [
  { id: "yt",  icon: "▶️",  label: "YouTube",  color: "#ff4444" },
  { id: "url", icon: "🌐", label: "Website",  color: "#38bdf8" },
  { id: "doc", icon: "📄", label: "Document", color: "#a78bfa" },
];

const TOOL_NAMES = {
  stickman: "Stickman scenes", script: "Script", video: "Production plan", thumbnail: "Thumbnails", titles: "Titles", seo: "SEO pack",
  plan: "Content calendar", stats: "Channel report", doc: "Document", yt: "YouTube analysis", url: "Website analysis",
};

// ---------------------------------------------------------------------------
// Library (saved generations) — shared via a tiny event bus
// ---------------------------------------------------------------------------
function saveToLibrary(item) {
  const lib = store.library();
  const entry = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), at: Date.now(), ...item };
  store.setLibrary([entry, ...lib]);
  window.dispatchEvent(new Event("atai:library"));
  return entry;
}

function useLibrary() {
  const [lib, setLib] = useState([]);
  useEffect(() => {
    const sync = () => setLib(store.library());
    sync();
    window.addEventListener("atai:library", sync);
    return () => window.removeEventListener("atai:library", sync);
  }, []);
  return lib;
}

// ---------------------------------------------------------------------------
// Generation hook: streaming, cancel, errors, auto-save
// ---------------------------------------------------------------------------
function useGenerator(tool) {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState(null);
  const ctrl = useRef(null);

  useEffect(() => () => ctrl.current && ctrl.current.abort(), []);

  async function run(input, { title, stream = true, onChunk, meta } = {}) {
    if (ctrl.current) ctrl.current.abort();
    ctrl.current = new AbortController();
    setLoading(true); setError(""); setOutput(""); setSource(null);
    try {
      const { text, source: src } = await runTool(tool, input, {
        signal: ctrl.current.signal,
        onChunk: stream ? setOutput : onChunk,
      });
      setOutput(text);
      setSource(src);
      if (text.trim() && !text.trim().startsWith("⚠️")) {
        saveToLibrary({ tool, title: title || (src && src.title) || TOOL_NAMES[tool], text, ...(meta || {}) });
      }
      return text;
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "Something went wrong.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function stop() {
    if (ctrl.current) ctrl.current.abort();
    setLoading(false);
  }

  return { output, loading, error, source, run, stop, setOutput };
}

// ---------------------------------------------------------------------------
// Minimal, safe Markdown renderer (headings, bold, lists, paragraphs)
// ---------------------------------------------------------------------------
function inline(text, keyBase) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4
      ? <strong key={keyBase + "-" + i} style={{ color: "#f1f5f9" }}>{p.slice(2, -2)}</strong>
      : p
  );
}

function Markdown({ text }) {
  const lines = text.split("\n");
  const out = [];
  let list = null;
  const flush = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      out.push(<Tag key={"l" + out.length} style={{ paddingLeft: 20, margin: "4px 0 10px" }}>{list.items}</Tag>);
      list = null;
    }
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flush();
      const size = h[1].length <= 2 ? 15 : 14;
      out.push(<div key={i} style={{ fontSize: size, fontWeight: 800, color: "#f1f5f9", margin: "14px 0 6px" }}>{inline(h[2].replace(/\*\*/g, ""), i)}</div>);
    } else if (ul || ol) {
      const ordered = Boolean(ol && !ul);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(<li key={i} style={{ margin: "3px 0" }}>{inline((ul || ol)[1], i)}</li>);
    } else if (!line.trim()) {
      flush();
    } else if (/^---+$/.test(line.trim())) {
      flush();
      out.push(<hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "12px 0" }} />);
    } else {
      flush();
      out.push(<p key={i} style={{ margin: "0 0 8px" }}>{inline(line, i)}</p>);
    }
  });
  flush();
  return <>{out}</>;
}

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

const fieldStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 14,
  background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)",
  color: "#f1f5f9", fontSize: 16, outline: "none", fontFamily: "inherit",
};

function TextInput({ style, ...rest }) {
  return <input {...rest} style={{ ...fieldStyle, ...style }} />;
}

function TextArea({ style, ...rest }) {
  return <textarea {...rest} style={{ ...fieldStyle, minHeight: 110, resize: "vertical", lineHeight: 1.5, ...style }} />;
}

function ActionButton({ onClick, loading, disabled, grad, children, onStop }) {
  if (loading) {
    return (
      <button onClick={onStop} style={{ width: "100%", padding: 14, borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#cbd5e1", fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 4 }}>
        <span style={{ animation: "pulse 1.2s infinite", display: "inline-block" }}>●</span>&nbsp; Generating… tap to stop
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: 14, borderRadius: 16, border: "none",
        background: disabled ? "rgba(255,255,255,0.06)" : grad,
        color: disabled ? "#475569" : "#fff",
        fontWeight: 800, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer",
        marginTop: 4, transition: "all .2s",
        boxShadow: disabled ? "none" : "0 4px 20px rgba(0,0,0,0.45)",
      }}
    >
      {children}
    </button>
  );
}

function SmallButton({ onClick, active, children }) {
  return (
    <button onClick={onClick} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: active ? "rgba(0,232,122,0.15)" : "rgba(0,0,0,0.35)", color: active ? "#00e87a" : "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div role="alert" style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,68,68,0.08)", border: "1.5px solid rgba(255,68,68,0.3)", color: "#fca5a5", fontSize: 13, lineHeight: 1.5 }}>
      {error}
    </div>
  );
}

function OutputBox({ text, accent, loading, filename }) {
  const [copied, setCopied] = useState(false);
  const endRef = useRef(null);
  if (!text && !loading) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {text && !loading && (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 6 }}>
          <SmallButton active={copied} onClick={async () => { if (await copyText(text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
            {copied ? "✓ Copied" : "Copy"}
          </SmallButton>
          <SmallButton onClick={() => downloadText(slug(filename) + ".txt", text)}>Download</SmallButton>
        </div>
      )}
      <div style={{
        background: "rgba(0,0,0,0.4)", border: "1.5px solid " + (accent || "rgba(255,255,255,0.1)"),
        borderRadius: 18, padding: "14px 16px", fontSize: 13.5, lineHeight: 1.75, color: "#cbd5e1",
        overflowWrap: "anywhere",
      }}>
        {text ? <Markdown text={text} /> : <span style={{ color: "#64748b", animation: "pulse 1.4s infinite" }}>Thinking…</span>}
        {loading && text && <span style={{ display: "inline-block", width: 7, height: 15, background: "#00e87a", marginLeft: 2, verticalAlign: "middle", animation: "pulse 1s infinite" }} />}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function NichePicker({ value, onChange }) {
  const isCustom = value && !NICHES.some((n) => n.name === value);
  const [custom, setCustom] = useState(isCustom);
  return (
    <div>
      <SectionLabel>Niche</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
        {NICHES.map((n) => {
          const on = value === n.name && !custom;
          return (
            <button key={n.name} onClick={() => { setCustom(false); onChange(on ? "" : n.name); }} style={{ padding: "9px 4px", borderRadius: 13, cursor: "pointer", fontWeight: 700, fontSize: 11, textAlign: "center", border: "1.5px solid " + (on ? n.color : "rgba(255,255,255,0.09)"), background: on ? n.color + "18" : "rgba(255,255,255,0.03)", color: on ? n.color : "#94a3b8", transition: "all .18s" }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{n.icon}</div>
              {n.name}
            </button>
          );
        })}
        <button onClick={() => { setCustom(true); onChange(""); }} style={{ gridColumn: "span 2", padding: "9px 4px", borderRadius: 13, cursor: "pointer", fontWeight: 700, fontSize: 11, border: "1.5px solid " + (custom ? "#e2e8f0" : "rgba(255,255,255,0.09)"), background: custom ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", color: custom ? "#f1f5f9" : "#94a3b8" }}>
          <div style={{ fontSize: 18, marginBottom: 2 }}>✏️</div>
          Custom niche
        </button>
      </div>
      {custom && (
        <TextInput autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Home cooking, Gaming news, Luxury travel" maxLength={80} style={{ marginTop: 8 }} />
      )}
    </div>
  );
}

function SegmentedPicker({ options, value, onChange, activeColor, columns }) {
  const c = activeColor || "#00e87a";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + (columns || options.length) + ",1fr)", gap: 7 }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{ padding: "9px 6px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 11, border: "1.5px solid " + (value === o.id ? c : "rgba(255,255,255,0.08)"), background: value === o.id ? c + "18" : "rgba(255,255,255,0.03)", color: value === o.id ? c : "#64748b", transition: "all .18s" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Stack = ({ children }) => <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>;

const onEnter = (fn) => (e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) fn(); };

// ---------------------------------------------------------------------------
// CREATE tools
// ---------------------------------------------------------------------------
const STICKMAN_SIZES = { landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080] };

function svgDataUrl(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function parseScenes(text, format) {
  const data = parseJsonOutput(text);
  if (!data || !Array.isArray(data.scenes)) return null;
  const [width, height] = STICKMAN_SIZES[format] || STICKMAN_SIZES.landscape;
  return data.scenes
    .map((sc) => ({ ...sc, svg: sanitizeSvg(sc.svg, { width, height }) }))
    .filter((sc) => sc.svg);
}

async function downloadPng(svg, filename, [width, height]) {
  const img = new Image();
  img.src = svgDataUrl(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename + ".png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function SceneGallery({ scenes, format, name }) {
  const [copied, setCopied] = useState(false);
  const size = STICKMAN_SIZES[format] || STICKMAN_SIZES.landscape;
  const portrait = format === "portrait";
  async function downloadAll() {
    for (let i = 0; i < scenes.length; i++) {
      await downloadPng(scenes[i].svg, slug(name) + "-scene-" + (i + 1), size);
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <SmallButton active={copied} onClick={async () => { await copyText(scenes.map((sc, i) => "Scene " + (i + 1) + ": " + sc.narration).join("\n\n")); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "✓ Copied" : "Copy narration"}</SmallButton>
        <SmallButton onClick={downloadAll}>⬇ Download all (PNG)</SmallButton>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: portrait ? "1fr 1fr" : "1fr", gap: 10 }}>
        {scenes.map((sc, i) => (
          <div key={i} style={{ borderRadius: 16, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgDataUrl(sc.svg)} alt={sc.title} style={{ width: "100%", display: "block", aspectRatio: size[0] + "/" + size[1], background: "#fff" }} />
            <div style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>{i + 1}. {sc.title}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <SmallButton onClick={() => downloadPng(sc.svg, slug(name) + "-scene-" + (i + 1), size)}>PNG</SmallButton>
                  <SmallButton onClick={() => { const blob = new Blob([sc.svg], { type: "image/svg+xml" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = slug(name) + "-scene-" + (i + 1) + ".svg"; a.click(); }}>SVG</SmallButton>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>{sc.narration}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StickmanTool() {
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(4);
  const [format, setFormat] = useState("landscape");
  const [theme, setTheme] = useState("light");
  const [captions, setCaptions] = useState(true);
  const [scenes, setScenes] = useState(null);
  const [progress, setProgress] = useState(0);
  const g = useGenerator("stickman");
  const ready = prompt.trim().length > 3;

  async function go() {
    if (!ready || g.loading) return;
    setScenes(null); setProgress(0);
    const text = await g.run(
      { prompt, count, format, theme, captions },
      { title: "Stickman: " + prompt.slice(0, 60), stream: false, onChunk: (t) => setProgress((t.match(/"svg"\s*:/g) || []).length), meta: { format } }
    );
    if (text == null) return;
    const parsed = parseScenes(text, format);
    if (parsed && parsed.length) { setScenes(parsed); g.setOutput(""); }
  }

  return (
    <Stack>
      <div style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6 }}>Turn a script or idea into consistent stickman scenes for faceless videos. Download as PNG for your editor.</div>
      <div>
        <SectionLabel>Script, idea or scene description</SectionLabel>
        <TextArea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={6000} placeholder={"e.g. A guy checks his bank account, panics, then starts budgeting and ends up relaxed on a beach.\n\nOr paste a section of your script."} />
      </div>
      <div>
        <SectionLabel>Number of scenes</SectionLabel>
        <SegmentedPicker value={String(count)} onChange={(v) => setCount(Number(v))} activeColor="#e2e8f0" options={[1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), label: String(n) }))} />
      </div>
      <div>
        <SectionLabel>Format</SectionLabel>
        <SegmentedPicker value={format} onChange={setFormat} activeColor="#e2e8f0" options={[{ id: "landscape", label: "🖥 16:9 Video" }, { id: "portrait", label: "📱 9:16 Short" }, { id: "square", label: "⬛ 1:1" }]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <SectionLabel>Background</SectionLabel>
          <SegmentedPicker value={theme} onChange={setTheme} activeColor="#e2e8f0" options={[{ id: "light", label: "⚪ White" }, { id: "dark", label: "⚫ Dark" }]} />
        </div>
        <div>
          <SectionLabel>Captions</SectionLabel>
          <SegmentedPicker value={captions ? "on" : "off"} onChange={(v) => setCaptions(v === "on")} activeColor="#e2e8f0" options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} />
        </div>
      </div>
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!ready} grad="linear-gradient(135deg,#64748b,#e2e8f0)">🧍 Draw {count} Scene{count > 1 ? "s" : ""}</ActionButton>
      {g.loading && (
        <div style={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center" }}>
          {progress === 0 ? "Planning scenes…" : "Drawing scene " + Math.min(progress, count) + " of " + count + "…"} This takes about 20–60 seconds.
        </div>
      )}
      <ErrorBox error={g.error} />
      {g.output && !scenes && !g.loading && <ErrorBox error={g.output.includes("⚠️") ? g.output.trim() : "The drawing didn't come out right. Please try again."} />}
      {scenes && <SceneGallery scenes={scenes} format={format} name={prompt.slice(0, 40)} />}
    </Stack>
  );
}

function ScriptTool() {
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [length, setLength] = useState("medium");
  const [tone, setTone] = useState("");
  const g = useGenerator("script");
  const ready = niche && topic.trim();
  const go = () => ready && !g.loading && g.run({ niche, topic, length, tone }, { title: topic });

  return (
    <Stack>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Video Topic</SectionLabel>
        <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 7 passive income ideas that actually work" onKeyDown={onEnter(go)} maxLength={500} />
      </div>
      <div>
        <SectionLabel>Length</SectionLabel>
        <SegmentedPicker value={length} onChange={setLength} options={[{ id: "short", label: "⚡ Short (60s)" }, { id: "medium", label: "🎬 8–10 min" }, { id: "long", label: "📚 15–20 min" }]} />
      </div>
      <div>
        <SectionLabel>Tone (optional)</SectionLabel>
        <TextInput value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. calm & authoritative, funny, dramatic" maxLength={60} />
      </div>
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!ready} grad="linear-gradient(135deg,#00e87a,#38bdf8)">✍️ Generate Script</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(0,232,122,0.25)" filename={"script-" + topic} />
    </Stack>
  );
}

function VideoTool() {
  const [idea, setIdea] = useState("");
  const g = useGenerator("video");
  const go = () => idea.trim() && !g.loading && g.run({ idea }, { title: idea });
  return (
    <Stack>
      <div>
        <SectionLabel>Video Idea or Title</SectionLabel>
        <TextInput value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. The Dark Truth About Social Media" onKeyDown={onEnter(go)} maxLength={500} />
      </div>
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!idea.trim()} grad="linear-gradient(135deg,#c084fc,#f472b6)">🎬 Generate Production Plan</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(192,132,252,0.25)" filename={"production-" + idea} />
    </Stack>
  );
}

function ThumbnailTool() {
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const g = useGenerator("thumbnail");
  const go = () => title.trim() && !g.loading && g.run({ title, niche }, { title });
  return (
    <Stack>
      <div>
        <SectionLabel>Video Title</SectionLabel>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter your video title…" onKeyDown={onEnter(go)} maxLength={200} />
      </div>
      <NichePicker value={niche} onChange={setNiche} />
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!title.trim()} grad="linear-gradient(135deg,#ff6b35,#f472b6)">🖼️ Generate Thumbnail Concepts</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(255,107,53,0.25)" filename={"thumbnails-" + title} />
    </Stack>
  );
}

function TitlesTool() {
  const [niche, setNiche] = useState("");
  const [seed, setSeed] = useState("");
  const [style, setStyle] = useState("viral");
  const [titles, setTitles] = useState([]);
  const [copied, setCopied] = useState(null);
  const g = useGenerator("titles");

  const STYLES = [
    { id: "viral", label: "🔥 Viral" }, { id: "listicle", label: "📋 List" }, { id: "story", label: "📖 Story" },
    { id: "controversial", label: "⚡ Hot Take" }, { id: "howto", label: "🛠️ How-To" }, { id: "secret", label: "🔐 Secret" },
  ];

  async function go() {
    if (!niche || g.loading) return;
    setTitles([]);
    const text = await g.run({ niche, seed, style }, { title: "Titles: " + (seed || niche), stream: false });
    if (text == null) return;
    const data = parseJsonOutput(text);
    if (data && Array.isArray(data.titles)) {
      setTitles(data.titles);
      g.setOutput("");
    }
  }

  return (
    <Stack>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Topic (optional)</SectionLabel>
        <TextInput value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. passive income, crypto, habits…" onKeyDown={onEnter(go)} maxLength={200} />
      </div>
      <div>
        <SectionLabel>Style</SectionLabel>
        <SegmentedPicker options={STYLES} value={style} onChange={setStyle} activeColor="#f59e0b" columns={3} />
      </div>
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!niche} grad="linear-gradient(135deg,#f59e0b,#ff6b35)">🔥 Generate 10 Titles</ActionButton>
      <ErrorBox error={g.error} />
      {g.output && !titles.length && !g.loading && <OutputBox text={g.output} accent="rgba(245,158,11,0.25)" filename="titles" />}
      {titles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SmallButton active={copied === "all"} onClick={async () => { await copyText(titles.join("\n")); setCopied("all"); setTimeout(() => setCopied(null), 1400); }}>{copied === "all" ? "✓ Copied" : "Copy all"}</SmallButton>
          </div>
          {titles.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", minWidth: 18 }}>{"#" + (i + 1)}</span>
              <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, lineHeight: 1.4 }}>{t}</span>
              <span style={{ fontSize: 10, color: t.length > 60 ? "#ff6b35" : "#475569", fontFamily: "monospace" }}>{t.length}</span>
              <SmallButton active={copied === i} onClick={async () => { await copyText(t); setCopied(i); setTimeout(() => setCopied(null), 1400); }}>{copied === i ? "✓" : "Copy"}</SmallButton>
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
}

function SEOTool() {
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(null);
  const g = useGenerator("seo");
  const level = { low: "#00e87a", medium: "#f59e0b", high: "#ff6b35" };
  const ready = niche && topic.trim();

  async function go() {
    if (!ready || g.loading) return;
    setData(null);
    const text = await g.run({ niche, topic }, { title: "SEO: " + topic, stream: false });
    if (text == null) return;
    const parsed = parseJsonOutput(text);
    if (parsed && Array.isArray(parsed.primary)) { setData(parsed); g.setOutput(""); }
  }

  async function copy(text, key) {
    await copyText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  }

  return (
    <Stack>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Video Topic</SectionLabel>
        <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. passive income for beginners" onKeyDown={onEnter(go)} maxLength={500} />
      </div>
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!ready} grad="linear-gradient(135deg,#38bdf8,#c084fc)">🔍 Build SEO Pack</ActionButton>
      <ErrorBox error={g.error} />
      {g.output && !data && !g.loading && <OutputBox text={g.output} accent="rgba(56,189,248,0.25)" filename="seo" />}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>Volume and competition are AI estimates — confirm with YouTube search suggestions or a keyword tool before relying on them.</div>
          {[["🎯 Primary", data.primary, "#00e87a"], ["📌 Secondary", data.secondary, "#38bdf8"], ["🔎 Long-tail", data.longtail, "#c084fc"]].map(([lbl, items, accent]) => (
            <div key={lbl}>
              <SectionLabel color={accent}>{lbl}</SectionLabel>
              {(items || []).map((kw, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 5 }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: "#e2e8f0" }}>{kw.keyword}</span>
                  <span title="Search volume (estimate)" style={{ fontSize: 10, color: "#94a3b8" }}>vol {kw.volume}</span>
                  <span title="Competition (estimate)" style={{ fontSize: 10, fontWeight: 800, color: level[kw.competition] || "#94a3b8", background: (level[kw.competition] || "#94a3b8") + "18", padding: "2px 7px", borderRadius: 20 }}>{kw.competition}</span>
                </div>
              ))}
            </div>
          ))}

          {Array.isArray(data.tags) && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <SectionLabel>🏷️ Tags</SectionLabel>
                <SmallButton active={copied === "tags"} onClick={() => copy(data.tags.join(", "), "tags")}>{copied === "tags" ? "✓ Copied" : "Copy all"}</SmallButton>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.tags.map((t, i) => <span key={i} style={{ padding: "5px 11px", background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.2)", borderRadius: 20, fontSize: 11, color: "#f472b6" }}>{t}</span>)}
              </div>
            </div>
          )}

          {data.title_formula && (
            <div style={{ padding: "12px 14px", background: "rgba(0,232,122,0.07)", border: "1.5px solid rgba(0,232,122,0.2)", borderRadius: 14 }}>
              <SectionLabel color="#00e87a">🏆 Title Formula</SectionLabel>
              <div style={{ fontSize: 13, color: "#e2e8f0" }}>{data.title_formula}</div>
            </div>
          )}

          {data.description && (
            <div style={{ padding: "12px 14px", background: "rgba(56,189,248,0.07)", border: "1.5px solid rgba(56,189,248,0.2)", borderRadius: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <SectionLabel color="#38bdf8">📝 Video Description</SectionLabel>
                <SmallButton active={copied === "desc"} onClick={() => copy(data.description + (data.hashtags ? "\n\n" + data.hashtags.join(" ") : ""), "desc")}>{copied === "desc" ? "✓ Copied" : "Copy"}</SmallButton>
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{data.description}</div>
              {Array.isArray(data.hashtags) && <div style={{ fontSize: 12, color: "#38bdf8", marginTop: 8 }}>{data.hashtags.join(" ")}</div>}
            </div>
          )}
        </div>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// RESEARCH tools
// ---------------------------------------------------------------------------
function QuestionField({ mode, value, onChange, onSubmit, placeholder }) {
  if (mode !== "ask") return null;
  return (
    <div>
      <SectionLabel>Your Question</SectionLabel>
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onEnter(onSubmit)} maxLength={500} />
    </div>
  );
}

function getVideoId(u) {
  const m = String(u).match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function YouTubeReader() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("summarize");
  const [question, setQuestion] = useState("");
  const g = useGenerator("yt");
  const videoId = getVideoId(url);
  const go = () => videoId && !g.loading && g.run({ url, mode, question });

  return (
    <Stack>
      <div>
        <SectionLabel>YouTube URL</SectionLabel>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://youtube.com/watch?v=…" inputMode="url" onKeyDown={onEnter(go)} style={{ borderColor: videoId ? "rgba(255,68,68,0.4)" : undefined }} />
        {url && !videoId && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 6 }}>Paste a full video, Shorts or youtu.be link.</div>}
      </div>

      {videoId && (
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid rgba(255,68,68,0.3)", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={"https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg"} alt="Video thumbnail" style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(transparent,rgba(0,0,0,0.8))" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
              {g.source ? g.source.title + (g.source.hasTranscript ? " · transcript loaded" : " · no transcript available") : "✓ Video detected"}
            </span>
          </div>
        </div>
      )}

      <div>
        <SectionLabel>What do you want?</SectionLabel>
        <SegmentedPicker value={mode} onChange={setMode} activeColor="#ff4444" options={[{ id: "summarize", label: "📋 Summary" }, { id: "keypoints", label: "🎯 Takeaways" }, { id: "script", label: "✍️ Remix" }, { id: "ask", label: "❓ Ask" }]} />
      </div>
      <QuestionField mode={mode} value={question} onChange={setQuestion} onSubmit={go} placeholder="e.g. What hook does this creator use?" />
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!videoId} grad="linear-gradient(135deg,#ff4444,#ff6b35)">▶️ Analyze Video</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(255,68,68,0.3)" filename={"video-" + ((g.source && g.source.title) || videoId)} />
    </Stack>
  );
}

function WebsiteReader() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("summarize");
  const [question, setQuestion] = useState("");
  const g = useGenerator("url");
  const isValid = /^(https?:\/\/)?[^\s/]+\.[^\s]{2,}/i.test(url);
  const go = () => isValid && !g.loading && g.run({ url, mode, question });

  return (
    <Stack>
      <div>
        <SectionLabel>Website URL</SectionLabel>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://example.com/article" inputMode="url" onKeyDown={onEnter(go)} style={{ borderColor: isValid ? "rgba(56,189,248,0.4)" : undefined }} />
        {g.source && <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 6 }}>✓ Read: {g.source.title || g.source.url}</div>}
      </div>
      <div>
        <SectionLabel>What do you want?</SectionLabel>
        <SegmentedPicker value={mode} onChange={setMode} activeColor="#38bdf8" options={[{ id: "summarize", label: "📋 Summary" }, { id: "keypoints", label: "🎯 Key Points" }, { id: "competitor", label: "🔍 Competitor" }, { id: "ask", label: "❓ Ask" }]} />
      </div>
      <QuestionField mode={mode} value={question} onChange={setQuestion} onSubmit={go} placeholder="e.g. What products do they sell?" />
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!isValid} grad="linear-gradient(135deg,#38bdf8,#00e87a)">🌐 Analyze Website</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(56,189,248,0.3)" filename={"site-" + ((g.source && g.source.title) || url)} />
    </Stack>
  );
}

function DocReader() {
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState("");
  const [inputMode, setInputMode] = useState("file");
  const [mode, setMode] = useState("summarize");
  const [question, setQuestion] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef(null);
  const g = useGenerator("doc");

  function handleFile(f) {
    setFileError("");
    if (!f) return;
    const ok = f.type === "application/pdf" || f.type.startsWith("text/") || /\.(txt|md|csv|srt|vtt|html?)$/i.test(f.name);
    if (!ok) return setFileError("Unsupported file type. Use PDF, TXT, MD, CSV, SRT or HTML.");
    if (f.type === "application/pdf" && f.size > 4 * 1024 * 1024) return setFileError("PDF is too large (max 4 MB).");
    if (f.size > 8 * 1024 * 1024) return setFileError("File is too large (max 8 MB).");
    setFile(f);
  }

  const ready = inputMode === "file" ? Boolean(file) : pasted.trim().length > 20;

  async function go() {
    if (!ready || g.loading) return;
    let input = { mode, question };
    if (inputMode === "paste") {
      input.text = pasted;
    } else if (file.type === "application/pdf") {
      input.pdfBase64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = () => rej(new Error("read failed"));
        r.readAsDataURL(file);
      });
    } else {
      input.text = await file.text();
      input.isHtml = /\.html?$/i.test(file.name) || file.type === "text/html";
    }
    g.run(input, { title: inputMode === "file" ? file.name : "Pasted text" });
  }

  return (
    <Stack>
      <SegmentedPicker value={inputMode} onChange={setInputMode} activeColor="#a78bfa" options={[{ id: "file", label: "📂 Upload file" }, { id: "paste", label: "📋 Paste text" }]} />
      {inputMode === "file" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current && fileRef.current.click()}
          role="button"
          tabIndex={0}
          style={{ border: "2px dashed " + (dragging ? "#a78bfa" : file ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"), borderRadius: 18, padding: "26px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "rgba(167,139,250,0.08)" : file ? "rgba(167,139,250,0.05)" : "rgba(255,255,255,0.02)", transition: "all .2s" }}
        >
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.srt,.vtt,.html,.htm" onChange={(e) => handleFile(e.target.files[0])} style={{ display: "none" }} />
          {file ? (
            <div>
              <div style={{ fontSize: 32, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", overflowWrap: "anywhere" }}>{file.name}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{(file.size / 1024).toFixed(1)} KB · tap to change</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>Tap or drop a file</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>PDF (4 MB), TXT, MD, CSV, SRT, HTML</div>
            </div>
          )}
        </div>
      ) : (
        <TextArea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste an article, transcript, notes or research…" style={{ minHeight: 160 }} />
      )}
      <ErrorBox error={fileError} />
      <div>
        <SectionLabel>What do you want?</SectionLabel>
        <SegmentedPicker value={mode} onChange={setMode} activeColor="#a78bfa" columns={3} options={[{ id: "summarize", label: "📋 Summarize" }, { id: "explain", label: "🧠 Explain" }, { id: "keypoints", label: "🎯 Key Points" }, { id: "video", label: "🎬 To Video" }, { id: "ask", label: "❓ Ask" }]} />
      </div>
      <QuestionField mode={mode} value={question} onChange={setQuestion} onSubmit={go} placeholder="e.g. What are the main risks mentioned?" />
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!ready} grad="linear-gradient(135deg,#a78bfa,#6366f1)">📄 Analyze Document</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(167,139,250,0.3)" filename={"doc-" + (file ? file.name : "notes")} />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// PLAN screen
// ---------------------------------------------------------------------------
function PlanScreen() {
  const [niche, setNiche] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [perWeek, setPerWeek] = useState(3);
  const g = useGenerator("plan");
  const go = () => niche && !g.loading && g.run({ niche, weeks, perWeek }, { title: weeks + "-week plan: " + niche });

  return (
    <Stack>
      <NichePicker value={niche} onChange={setNiche} />
      <div>
        <SectionLabel>Weeks to Plan</SectionLabel>
        <SegmentedPicker value={String(weeks)} onChange={(v) => setWeeks(Number(v))} activeColor="#34d399" options={[1, 2, 3, 4].map((w) => ({ id: String(w), label: w + (w === 1 ? " week" : " weeks") }))} />
      </div>
      <div>
        <SectionLabel>Videos per Week</SectionLabel>
        <SegmentedPicker value={String(perWeek)} onChange={(v) => setPerWeek(Number(v))} activeColor="#34d399" options={[1, 2, 3, 5, 7].map((n) => ({ id: String(n), label: n === 7 ? "Daily" : String(n) }))} />
        <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>{weeks * perWeek} videos total</div>
      </div>
      <ActionButton onClick={go} loading={g.loading} onStop={g.stop} disabled={!niche} grad="linear-gradient(135deg,#34d399,#38bdf8)">📅 Generate Calendar</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(52,211,153,0.25)" filename={"calendar-" + niche} />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// CHANNEL screen (user-entered stats, stored on this device)
// ---------------------------------------------------------------------------
const CHANNEL_FIELDS = [
  ["niche", "Niche", "e.g. Personal finance"],
  ["subscribers", "Subscribers", "4820"],
  ["views", "Monthly views", "312000"],
  ["revenue", "Monthly revenue ($)", "847"],
  ["videos", "Videos published", "23"],
  ["frequency", "Upload frequency", "e.g. 3 per week"],
  ["avd", "Avg view duration", "e.g. 4:12"],
  ["ctr", "Click-through rate", "e.g. 6.8%"],
];

function fmt(n) {
  const v = Number(String(n).replace(/[^0-9.]/g, ""));
  if (!n || isNaN(v)) return "—";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
}

function useChannel() {
  const [channel, setChannelState] = useState(null);
  useEffect(() => setChannelState(store.channel()), []);
  const setChannel = (c) => { setChannelState(c); store.setChannel(c); };
  return [channel, setChannel];
}

function StatsScreen() {
  const [channel, setChannel] = useChannel();
  const [draft, setDraft] = useState({});
  const [editing, setEditing] = useState(false);
  const g = useGenerator("stats");

  useEffect(() => {
    if (channel) setDraft(channel);
    else setEditing(true);
  }, [channel]);

  const c = channel || {};
  const STATS = [
    { label: "Subscribers", value: fmt(c.subscribers), color: "#00e87a" },
    { label: "Monthly Views", value: fmt(c.views), color: "#38bdf8" },
    { label: "Monthly Revenue", value: c.revenue ? "$" + fmt(c.revenue) : "—", color: "#c084fc" },
    { label: "Est. RPM", value: c.revenue && c.views ? "$" + ((Number(c.revenue) / Number(c.views)) * 1000).toFixed(2) : "—", color: "#f472b6" },
  ];

  if (editing) {
    return (
      <Stack>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>Enter your channel numbers from YouTube Studio → Analytics. They're saved on this device only.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CHANNEL_FIELDS.map(([k, label, ph]) => (
            <div key={k} style={{ gridColumn: k === "niche" ? "span 2" : undefined }}>
              <SectionLabel>{label}</SectionLabel>
              <TextInput value={draft[k] || ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder={ph} inputMode={["subscribers", "views", "revenue", "videos"].includes(k) ? "decimal" : undefined} maxLength={k === "niche" ? 80 : 20} />
            </div>
          ))}
        </div>
        <div>
          <SectionLabel>Top videos / notes (optional)</SectionLabel>
          <TextArea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={"e.g.\n7 Money Habits — 142K views\nAI Revolution — 89K views"} maxLength={2000} />
        </div>
        <ActionButton onClick={() => { setChannel(draft); setEditing(false); }} grad="linear-gradient(135deg,#00e87a,#38bdf8)">💾 Save Channel</ActionButton>
        {channel && <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}>Cancel</button>}
      </Stack>
    );
  }

  return (
    <Stack>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{c.niche || "My channel"}</div>
        <SmallButton onClick={() => setEditing(true)}>✏️ Edit stats</SmallButton>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {STATS.map((s) => (
          <div key={s.label} style={{ padding: 16, background: "rgba(255,255,255,0.04)", border: "1.5px solid " + s.color + "22", borderRadius: 18 }}>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: "ui-monospace,monospace", marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <ActionButton onClick={() => !g.loading && g.run({ channel: c }, { title: "Channel report" })} loading={g.loading} onStop={g.stop} grad="linear-gradient(135deg,#c084fc,#38bdf8)">📊 AI Growth Report</ActionButton>
      <ErrorBox error={g.error} />
      <OutputBox text={g.output} loading={g.loading} accent="rgba(192,132,252,0.25)" filename="channel-report" />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// LIBRARY (saved outputs)
// ---------------------------------------------------------------------------
function LibraryScreen({ onClose }) {
  const lib = useLibrary();
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState("");
  const items = lib.filter((x) => !query || (x.title + " " + x.text).toLowerCase().includes(query.toLowerCase()));

  function remove(id) {
    store.setLibrary(store.library().filter((x) => x.id !== id));
    window.dispatchEvent(new Event("atai:library"));
    setOpen(null);
  }

  const item = open && lib.find((x) => x.id === open);
  if (item) {
    return (
      <Stack>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <SmallButton onClick={() => setOpen(null)}>← Back</SmallButton>
          <SmallButton onClick={() => { if (confirm("Delete this item?")) remove(item.id); }}>🗑 Delete</SmallButton>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{item.title}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{TOOL_NAMES[item.tool]} · {new Date(item.at).toLocaleString()}</div>
        </div>
        {item.tool === "stickman"
          ? <SceneGallery scenes={parseScenes(item.text, item.format) || []} format={item.format} name={item.title} />
          : <OutputBox text={item.tool === "titles" || item.tool === "seo" ? prettyJson(item.text) : item.text} filename={item.title} />}
      </Stack>
    );
  }

  return (
    <Stack>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{lib.length} saved · stored on this device</div>
        <SmallButton onClick={onClose}>Close</SmallButton>
      </div>
      {lib.length > 3 && <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" />}
      {items.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#475569", fontSize: 13 }}>{lib.length ? "No matches." : "Everything you generate is saved here automatically."}</div>}
      {items.map((x) => (
        <button key={x.id} onClick={() => setOpen(x.id)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#f1f5f9" }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.title}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{TOOL_NAMES[x.tool]} · {new Date(x.at).toLocaleDateString()}</div>
        </button>
      ))}
    </Stack>
  );
}

function prettyJson(text) {
  const d = parseJsonOutput(text);
  if (!d) return text;
  if (Array.isArray(d.titles)) return d.titles.map((t, i) => i + 1 + ". " + t).join("\n");
  const kw = (arr) => (arr || []).map((k) => "- " + k.keyword + " (volume " + k.volume + ", competition " + k.competition + ")").join("\n");
  return [
    "## Primary keywords", kw(d.primary), "## Secondary keywords", kw(d.secondary), "## Long-tail keywords", kw(d.longtail),
    "## Tags", (d.tags || []).join(", "), "## Title formula", d.title_formula || "", "## Description", d.description || "", (d.hashtags || []).join(" "),
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------
function SettingsScreen({ onClose, accessRequired }) {
  const [settings, setSettings] = useState(store.settings());
  const update = (s) => { setSettings(s); store.setSettings(s); };
  return (
    <Stack>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Settings</div>
        <SmallButton onClick={onClose}>Done</SmallButton>
      </div>
      <div>
        <SectionLabel>Output language</SectionLabel>
        <select value={settings.language} onChange={(e) => update({ ...settings, language: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div style={{ padding: "14px 16px", background: "rgba(0,232,122,0.07)", border: "1.5px solid rgba(0,232,122,0.15)", borderRadius: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#00e87a", marginBottom: 4 }}>📱 Install as an app</div>
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          <strong>iPhone:</strong> Share → Add to Home Screen<br /><strong>Android:</strong> Menu → Install app
        </div>
      </div>
      <SmallButton onClick={() => { if (confirm("Delete all saved items and channel stats on this device?")) { store.setLibrary([]); store.setChannel(null); window.dispatchEvent(new Event("atai:library")); } }}>🗑 Clear saved data on this device</SmallButton>
      {accessRequired && <SmallButton onClick={() => { store.setCode(""); window.dispatchEvent(new Event("atai:locked")); }}>🔒 Sign out (remove access code)</SmallButton>}
      <div style={{ fontSize: 11, color: "#475569", textAlign: "center" }}>
        <a href="/terms" style={{ color: "#64748b" }}>Terms</a> · <a href="/privacy" style={{ color: "#64748b" }}>Privacy</a>
      </div>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// ACCESS GATE
// ---------------------------------------------------------------------------
function AccessGate({ checkoutUrl, onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.trim() }) });
      if (res.ok) { store.setCode(code.trim()); onUnlock(); }
      else setError("That code isn't valid. Check your purchase email and try again.");
    } catch {
      setError("Couldn't verify the code. Check your connection.");
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>AutoTube<span style={{ color: "#00e87a" }}>AI</span></div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Enter the access code from your purchase email.</div>
        <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" onKeyDown={onEnter(submit)} autoFocus autoComplete="one-time-code" style={{ textAlign: "center", letterSpacing: 1 }} />
        <ActionButton onClick={submit} loading={false} disabled={!code.trim() || busy} grad="linear-gradient(135deg,#00e87a,#38bdf8)">{busy ? "Checking…" : "Unlock"}</ActionButton>
        <ErrorBox error={error} />
        {checkoutUrl && <a href={checkoutUrl} style={{ fontSize: 13, color: "#00e87a", fontWeight: 700 }}>Don't have a code? Get access →</a>}
        <a href="/" style={{ fontSize: 12, color: "#64748b" }}>← Back to home</a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HOME screen
// ---------------------------------------------------------------------------
function HomeScreen({ onNav, onLibrary }) {
  const [channel] = useChannel();
  const lib = useLibrary();
  const QUICK = [
    { icon: "🧍", label: "Stickman Scenes", sub: "Images for faceless videos", sec: "create", sub2: "stickman", color: "#e2e8f0", wide: true },
    { icon: "✍️", label: "Write Script",  sub: "Word-for-word scripts", sec: "create", sub2: "script", color: "#00e87a" },
    { icon: "🔥", label: "Viral Titles",  sub: "10 title ideas fast",   sec: "create", sub2: "titles", color: "#f59e0b" },
    { icon: "▶️",  label: "Analyze Video", sub: "Learn from any video",  sec: "reader", sub2: "yt",     color: "#ff4444" },
    { icon: "🔍", label: "SEO Pack",      sub: "Tags + description",    sec: "create", sub2: "seo",    color: "#38bdf8" },
    { icon: "🌐", label: "Competitor",    sub: "Analyze any website",   sec: "reader", sub2: "url",    color: "#34d399" },
    { icon: "📅", label: "Content Plan",  sub: "Weeks of ideas",        sec: "plan",   sub2: null,     color: "#a78bfa" },
  ];

  return (
    <div style={{ animation: "fadeUp .35s ease" }}>
      {channel ? (
        <button onClick={() => onNav("stats")} style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 22, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          {[["👥", fmt(channel.subscribers), "Subscribers"], ["👁", fmt(channel.views), "Views / mo"], ["💰", channel.revenue ? "$" + fmt(channel.revenue) : "—", "Revenue / mo"]].map(([icon, v, l]) => (
            <div key={l} style={{ padding: "13px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, textAlign: "center" }}>
              <div style={{ fontSize: 18 }}>{icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", fontFamily: "ui-monospace,monospace", marginTop: 2 }}>{v}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </button>
      ) : (
        <button onClick={() => onNav("stats")} style={{ width: "100%", textAlign: "left", padding: "14px 16px", marginBottom: 22, borderRadius: 18, background: "linear-gradient(135deg,rgba(0,232,122,0.12),rgba(56,189,248,0.08))", border: "1.5px solid rgba(0,232,122,0.25)", cursor: "pointer", color: "#f1f5f9" }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>👋 Welcome! Add your channel stats</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>Get a personalised AI growth report in under a minute →</div>
        </button>
      )}

      <SectionLabel>Quick Actions</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 22 }}>
        {QUICK.map((item, i) => (
          <button key={i} onClick={() => onNav(item.sec, item.sub2)} style={{ gridColumn: item.wide ? "span 2" : undefined, padding: "16px 14px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", textAlign: "left", cursor: "pointer", animation: "fadeUp " + (0.15 + i * 0.07) + "s ease", color: "#f1f5f9" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{item.sub}</div>
            <div style={{ height: 2, borderRadius: 2, background: "linear-gradient(90deg," + item.color + ",transparent)", marginTop: 8, opacity: 0.6 }} />
          </button>
        ))}
      </div>

      {lib.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>Recent</SectionLabel>
            <button onClick={onLibrary} style={{ background: "none", border: "none", color: "#00e87a", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 7 }}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lib.slice(0, 3).map((x) => (
              <button key={x.id} onClick={onLibrary} style={{ textAlign: "left", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "#e2e8f0", fontSize: 12.5 }}>
                <span style={{ color: "#64748b" }}>{TOOL_NAMES[x.tool]} · </span>{x.title}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROOT APP
// ---------------------------------------------------------------------------
export default function App() {
  const [section, setSection] = useState("home");
  const [createTool, setCreateTool] = useState("script");
  const [readerMode, setReaderMode] = useState("yt");
  const [overlay, setOverlay] = useState(null); // "library" | "settings" | null
  const [access, setAccess] = useState({ checked: false, required: false, unlocked: false, checkoutUrl: null });

  useEffect(() => {
    let alive = true;
    fetch("/api/access")
      .then((r) => r.json())
      .then(async (d) => {
        let unlocked = !d.required;
        if (d.required && store.code()) {
          const r = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: store.code() }) });
          unlocked = r.ok;
        }
        if (alive) setAccess({ checked: true, required: d.required, unlocked, checkoutUrl: d.checkoutUrl });
      })
      .catch(() => alive && setAccess({ checked: true, required: false, unlocked: true, checkoutUrl: null }));
    const lock = () => setAccess((a) => (a.required ? { ...a, unlocked: false } : a));
    window.addEventListener("atai:locked", lock);
    return () => { alive = false; window.removeEventListener("atai:locked", lock); };
  }, []);

  function handleNav(sec, sub) {
    setOverlay(null);
    setSection(sec);
    if (sec === "create" && sub) setCreateTool(sub);
    if (sec === "reader" && sub) setReaderMode(sub);
    window.scrollTo(0, 0);
  }

  if (!access.checked) return <div style={{ minHeight: "100dvh" }} />;
  if (access.required && !access.unlocked) return <AccessGate checkoutUrl={access.checkoutUrl} onUnlock={() => setAccess({ ...access, unlocked: true })} />;

  const activeSec = NAV.find((s) => s.id === section);
  const createMap = { stickman: <StickmanTool />, script: <ScriptTool />, video: <VideoTool />, thumbnail: <ThumbnailTool />, titles: <TitlesTool />, seo: <SEOTool /> };
  const readerMap = { doc: <DocReader />, yt: <YouTubeReader />, url: <WebsiteReader /> };
  const headerBtn = { width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", fontSize: 15, cursor: "pointer" };

  // Keep every screen mounted so in-progress generations and inputs survive tab switches.
  const show = (on) => ({ display: on ? "block" : "none", animation: on ? "fadeUp .25s ease" : undefined });

  return (
    <div style={{ minHeight: "100dvh", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <div style={{ height: "env(safe-area-inset-top,0px)" }} />

      {/* Header */}
      <header style={{ padding: "14px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,13,26,0.97)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: !overlay && (section === "create" || section === "reader") ? 12 : 0 }}>
          <button onClick={() => handleNav("home")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "#f1f5f9" }}>
            <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.5 }}>
              AutoTube<span style={{ color: "#00e87a" }}>AI</span>
              {(overlay || section !== "home") && <span style={{ color: "#334155" }}> / </span>}
              {(overlay || section !== "home") && <span style={{ fontSize: 16, color: "#94a3b8" }}>{overlay === "library" ? "Library" : overlay === "settings" ? "Settings" : activeSec && activeSec.label}</span>}
            </div>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>YouTube Automation Studio</div>
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button aria-label="Library" onClick={() => setOverlay(overlay === "library" ? null : "library")} style={headerBtn}>📚</button>
            <button aria-label="Settings" onClick={() => setOverlay(overlay === "settings" ? null : "settings")} style={headerBtn}>⚙️</button>
          </div>
        </div>

        {!overlay && section === "create" && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
            {CREATE_TOOLS.map((t) => (
              <button key={t.id} onClick={() => setCreateTool(t.id)} style={{ padding: "7px 13px", borderRadius: 20, border: "1.5px solid " + (createTool === t.id ? t.color : "rgba(255,255,255,0.08)"), background: createTool === t.id ? t.color + "18" : "rgba(255,255,255,0.03)", color: createTool === t.id ? t.color : "#64748b", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all .18s" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        {!overlay && section === "reader" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
            {READER_MODES.map((m) => (
              <button key={m.id} onClick={() => setReaderMode(m.id)} style={{ padding: "9px 8px", borderRadius: 13, cursor: "pointer", fontWeight: 700, fontSize: 11, textAlign: "center", border: "1.5px solid " + (readerMode === m.id ? m.color : "rgba(255,255,255,0.07)"), background: readerMode === m.id ? m.color + "18" : "rgba(255,255,255,0.03)", color: readerMode === m.id ? m.color : "#64748b", transition: "all .2s" }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      <main style={{ flex: 1, padding: "18px 16px calc(100px + env(safe-area-inset-bottom,0px))" }}>
        {overlay === "library" && <LibraryScreen onClose={() => setOverlay(null)} />}
        {overlay === "settings" && <SettingsScreen onClose={() => setOverlay(null)} accessRequired={access.required} />}
        <div style={{ display: overlay ? "none" : "block" }}>
          <div style={show(section === "home")}><HomeScreen onNav={handleNav} onLibrary={() => setOverlay("library")} /></div>
          {CREATE_TOOLS.map((t) => <div key={t.id} style={show(section === "create" && createTool === t.id)}>{createMap[t.id]}</div>)}
          {READER_MODES.map((m) => <div key={m.id} style={show(section === "reader" && readerMode === m.id)}>{readerMap[m.id]}</div>)}
          <div style={show(section === "plan")}><PlanScreen /></div>
          <div style={show(section === "stats")}><StatsScreen /></div>
        </div>
      </main>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, paddingBottom: "calc(6px + env(safe-area-inset-bottom,0px))", background: "rgba(8,13,26,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", zIndex: 50 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)" }}>
          {NAV.map((s) => {
            const on = section === s.id && !overlay;
            return (
              <button key={s.id} onClick={() => handleNav(s.id)} aria-current={on ? "page" : undefined} style={{ padding: "10px 4px 6px", border: "none", background: "transparent", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 20, filter: on ? "none" : "grayscale(0.6)", opacity: on ? 1 : 0.7 }}>{s.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: on ? "#00e87a" : "#64748b" }}>{s.label}</div>
                <div style={{ width: 16, height: 2, borderRadius: 2, background: on ? "#00e87a" : "transparent", margin: "4px auto 0" }} />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
