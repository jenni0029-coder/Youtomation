// Sanitise model-generated SVG. The client also renders SVGs through <img>,
// where scripts never run and external resources never load; this is a second layer.
export function sanitizeSvg(raw, { width, height }) {
  let s = String(raw || "").trim();
  const start = s.indexOf("<svg");
  const end = s.lastIndexOf("</svg>");
  if (start < 0 || end < start) return null;
  s = s.slice(start, end + 6);

  s = s
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|image|use)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|image|use)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, "none")
    .replace(/javascript:/gi, "");

  // Normalise the root element: fixed size, correct namespace, our viewBox.
  s = s.replace(/<svg\b[^>]*>/i, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`);
  if (s.length > 200_000) return null;
  return s;
}
