// Server-side fetching of source material for the reader tools, so the model
// works from real content instead of guessing from a bare URL.
import { lookup } from "node:dns/promises";
import net from "node:net";

const UA = "Mozilla/5.0 (compatible; AutoTubeAI/1.0; +https://github.com/)";
const MAX_BYTES = 2_000_000;
const MAX_CHARS = 40_000;

export class SourceError extends Error {}

export function getVideoId(url) {
  const m = String(url || "").match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// SSRF protection: only fetch public http(s) hosts.
// ---------------------------------------------------------------------------
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new SourceError("That doesn't look like a valid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new SourceError("Only http and https URLs are supported.");
  if (u.username || u.password) throw new SourceError("URLs with credentials are not supported.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new SourceError("That address is not allowed.");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new SourceError("Couldn't find that website.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new SourceError("That address is not allowed.");
  return u;
}

async function safeFetch(raw, { accept = "text/html,*/*" } = {}) {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(url);
    const res = await fetch(u, {
      redirect: "manual",
      headers: { "user-agent": UA, accept, "accept-language": "en-US,en;q=0.8" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), u).toString();
      continue;
    }
    if (!res.ok) throw new SourceError(`The site responded with an error (${res.status}).`);
    return { res, finalUrl: u.toString() };
  }
  throw new SourceError("Too many redirects.");
}

async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { reader.cancel(); break; }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decodeEntities(tag.match(/content=["']([^"']*)["']/i)?.[1] || "") : "";
}

export function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(nav|footer)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Website
// ---------------------------------------------------------------------------
export async function fetchWebsite(rawUrl) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;
  const { res, finalUrl } = await safeFetch(url);
  const type = res.headers.get("content-type") || "";
  if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) throw new SourceError("That URL isn't a web page (it returned " + (type.split(";")[0] || "unknown content") + ").");
  const html = await readCapped(res);
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "");
  const description = meta(html, "description") || meta(html, "og:description");
  let body = htmlToText(html);
  if (body.length < 200) throw new SourceError("Couldn't read enough text from that page (it may require JavaScript or block bots).");
  const truncated = body.length > MAX_CHARS;
  if (truncated) body = body.slice(0, MAX_CHARS);
  return {
    text:
      `<page url="${finalUrl}">\nTitle: ${title}\nMeta description: ${description}\n\n${body}${truncated ? "\n[Content truncated]" : ""}\n</page>`,
    meta: { title, url: finalUrl },
  };
}

// ---------------------------------------------------------------------------
// YouTube: title/channel via oEmbed, description + captions from the watch page.
// ---------------------------------------------------------------------------
export function extractPlayerResponse(html) {
  const marker = "ytInitialPlayerResponse = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length, depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(i, j + 1)); } catch { return null; }
    }
  }
  return null;
}

async function fetchTranscript(player) {
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) return "";
  const track = tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") || tracks.find((t) => t.languageCode?.startsWith("en")) || tracks[0];
  try {
    const res = await fetch(track.baseUrl + "&fmt=json3", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return "";
    const raw = await res.text();
    if (!raw) return "";
    const data = JSON.parse(raw);
    return (data.events || [])
      .flatMap((e) => (e.segs || []).map((s) => s.utf8))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

export async function fetchYouTube(rawUrl) {
  const id = getVideoId(rawUrl);
  if (!id) throw new SourceError("That doesn't look like a YouTube video link.");
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;

  const [oembed, page] = await Promise.all([
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8_000) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(watchUrl + "&hl=en", { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.8" }, signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.text() : "")).catch(() => ""),
  ]);

  if (!oembed && !page) throw new SourceError("Couldn't reach YouTube for that video. It may be private or removed.");

  const player = page ? extractPlayerResponse(page) : null;
  const d = player?.videoDetails || {};
  const transcript = await fetchTranscript(player);
  const title = oembed?.title || d.title || "";
  if (!title) throw new SourceError("Couldn't find that video. It may be private, age-restricted or removed.");

  const minutes = d.lengthSeconds ? Math.round(Number(d.lengthSeconds) / 60) : null;
  const parts = [
    `Title: ${title}`,
    `Channel: ${oembed?.author_name || d.author || "unknown"}`,
    minutes != null ? `Length: ~${minutes} min` : "",
    d.viewCount ? `Views: ${Number(d.viewCount).toLocaleString("en-US")}` : "",
    d.keywords?.length ? `Tags: ${d.keywords.slice(0, 20).join(", ")}` : "",
    d.shortDescription ? `\nDescription:\n${d.shortDescription.slice(0, 5000)}` : "",
    transcript
      ? `\nTranscript:\n${transcript.slice(0, MAX_CHARS)}${transcript.length > MAX_CHARS ? " [truncated]" : ""}`
      : "\n[No transcript was available for this video — work from the title, description and tags only, and say so briefly.]",
  ].filter(Boolean);

  return {
    text: `<video url="${watchUrl}">\n${parts.join("\n")}\n</video>`,
    meta: { title, channel: oembed?.author_name || d.author || "", hasTranscript: Boolean(transcript) },
  };
}
