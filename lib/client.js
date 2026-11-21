"use client";
// Browser-side helpers: API calls, local storage, small utilities.

const CODE_KEY = "atai.accessCode";
const SETTINGS_KEY = "atai.settings";
const LIBRARY_KEY = "atai.library";
const CHANNEL_KEY = "atai.channel";

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const store = {
  code: () => load(CODE_KEY, ""),
  setCode: (c) => save(CODE_KEY, c),
  settings: () => load(SETTINGS_KEY, { language: "English" }),
  setSettings: (s) => save(SETTINGS_KEY, s),
  library: () => load(LIBRARY_KEY, []),
  setLibrary: (l) => save(LIBRARY_KEY, l.slice(0, 100)),
  channel: () => load(CHANNEL_KEY, null),
  setChannel: (c) => save(CHANNEL_KEY, c),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Call a generation tool. Streams text through onChunk(fullTextSoFar).
 * Resolves to { text, source }.
 */
export async function runTool(tool, input, { onChunk, signal } = {}) {
  const settings = store.settings();
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-access-code": store.code() },
    body: JSON.stringify({ tool, input: { language: settings.language, ...input } }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) window.dispatchEvent(new Event("atai:locked"));
    throw new ApiError(data.error || "Request failed (" + res.status + ").", res.status);
  }

  let source = null;
  try {
    const h = res.headers.get("x-source");
    if (h) source = JSON.parse(decodeURIComponent(h));
  } catch {}

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onChunk && onChunk(text);
  }
  text += decoder.decode();
  onChunk && onChunk(text);
  return { text, source };
}

export function parseJsonOutput(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function slug(s) {
  return (s || "autotube").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "autotube";
}
