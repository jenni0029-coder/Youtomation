// Server-side prompt builders. The client only sends a tool id and its inputs;
// prompts are assembled here so the API route cannot be used as an open proxy.

export const NICHES = {
  Finance: "Finance & Investing",
  "True Crime": "True Crime / History",
  "Self Help": "Self Improvement",
  Tech: "Tech Explainers",
  Wellness: "Meditation / Wellness",
  AI: "AI & Future Tech",
};

export const LANGUAGES = [
  "English", "Spanish", "Portuguese", "French", "German", "Italian",
  "Hindi", "Indonesian", "Japanese", "Korean", "Arabic", "Turkish",
];

const SYSTEM = [
  "You are AutoTubeAI, an expert YouTube strategist, scriptwriter and SEO specialist for faceless and creator-led channels.",
  "Write practical, specific, ready-to-use output. No filler, no disclaimers about being an AI.",
  "Format with Markdown: '## ' headings, short paragraphs, '- ' bullet lists, **bold** for emphasis. No tables.",
  "Never invent facts about a specific video, website, or channel beyond the source material you are given. If source material is missing or thin, say so briefly and work from what is available.",
  "Do not promise specific view counts or earnings; give ranges and label them as estimates.",
].join(" ");

class InputError extends Error {}
export { InputError };

function str(v, name, { required = false, max = 500 } = {}) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new InputError(`Missing ${name}.`);
  if (s.length > max) throw new InputError(`${name} is too long (max ${max} characters).`);
  return s;
}

function oneOf(v, options, fallback) {
  return options.includes(v) ? v : fallback;
}

function niche(v, required = true) {
  const raw = str(v, "niche", { required, max: 80 });
  return NICHES[raw] || raw || "general";
}

function langLine(v) {
  const lang = oneOf(v, LANGUAGES, "English");
  return lang === "English" ? "" : `\n\nWrite the entire response in ${lang}.`;
}

// JSON schemas for structured outputs.
const TITLES_SCHEMA = {
  type: "object",
  properties: {
    titles: { type: "array", items: { type: "string" } },
  },
  required: ["titles"],
  additionalProperties: false,
};

const KEYWORD = {
  type: "object",
  properties: {
    keyword: { type: "string" },
    volume: { type: "string", enum: ["low", "medium", "high"] },
    competition: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["keyword", "volume", "competition"],
  additionalProperties: false,
};

const SEO_SCHEMA = {
  type: "object",
  properties: {
    primary: { type: "array", items: KEYWORD },
    secondary: { type: "array", items: KEYWORD },
    longtail: { type: "array", items: KEYWORD },
    tags: { type: "array", items: { type: "string" } },
    title_formula: { type: "string" },
    description: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["primary", "secondary", "longtail", "tags", "title_formula", "description", "hashtags"],
  additionalProperties: false,
};

const STICKMAN_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          narration: { type: "string" },
          svg: { type: "string" },
        },
        required: ["title", "narration", "svg"],
        additionalProperties: false,
      },
    },
  },
  required: ["scenes"],
  additionalProperties: false,
};

export const STICKMAN_SIZES = { landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080] };

const STICKMAN_STYLE = (w, h, theme, captions) => `
STICKMAN ART STYLE (follow exactly so every scene matches):
- Each svg is a complete standalone <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">.
- Background: a full-size <rect> filled ${theme === "dark" ? "#0f172a" : "#ffffff"}. Line colour for figures: ${theme === "dark" ? "#f8fafc" : "#111111"}.
- Figures are classic stick figures: head = circle r=${h > w ? Math.round(w * 0.072) : Math.round(h * 0.05)} (filled with the background colour), body/arms/legs = straight or gently bent lines, stroke-width ${h > w ? 13 : Math.round(Math.min(w, h) * 0.0095)}, stroke-linecap="round", stroke-linejoin="round". Draw each figure inside <g transform="translate(x,y)"> so poses are easy to read.
- SIZE: the main standing figure is about ${h > w ? Math.round(w * 0.75) : Math.round(h * 0.5)}px tall (head to feet) so it reads clearly on a phone screen. Secondary figures can be smaller to show distance.
- ANATOMY (keep it consistent): neck starts at the bottom of the head; BOTH arms attach at one shoulder point just below the neck (about 12% of figure height below the head), never lower on the torso; legs attach at one hip point; elbows and knees bend naturally. Hands that hold or use a prop must end ON the prop (overlapping its edge or gripping it), not stop short of it.
- POSES: keep them simple and readable — standing, walking, pointing, arms raised, hand on chin. Avoid crossed limbs and tangled overlaps. If a figure sits, draw a clear seat and a simple 90° knee bend with both shins straight down; hands-behind-head is fine only if both elbows stay clearly outside the head.
- Faces are minimal but expressive: dot eyes, an arc mouth, optional eyebrows. Emotion must be obvious at a glance.
- Use ONE accent colour per scene (e.g. #ef4444, #22c55e, #3b82f6 or #f59e0b) for the key prop, arrow, money, chart or highlight. Props are built from simple shapes (rect, circle, path, polygon).
- Composition: the figures and their props form one group that is visually centred and fills roughly the middle 60-70% of the frame width — no large empty half. Clear focal point, nothing touching the edges (keep 80px margin). Ground line optional.
- ${captions ? "Add a short caption (max 6 words) in a bold sans-serif (font-family=\"Arial, Helvetica, sans-serif\", font-weight=\"700\", font-size 64-80) ALWAYS centred near the top of the frame (same position in every scene, about 12-15% down) and never covering the figures. Speech bubbles allowed (max 5 words)." : "No captions or on-image text, except tiny labels on props (e.g. \"$\", \"2024\") when essential."}
- Only these elements: svg, g, rect, circle, ellipse, line, polyline, polygon, path, text, tspan, defs, linearGradient, radialGradient, stop. No <image>, <script>, <style>, <use>, <foreignObject>, filters, external fonts or links, and no animation.
- Keep each svg compact (well under 6,000 characters): no comments, round coordinates to integers.`;

const SCRIPT_LENGTHS = {
  short: "a 60-second YouTube Short (about 150 words of narration)",
  medium: "an 8-10 minute video (about 1,300-1,600 words of narration)",
  long: "a 15-20 minute deep-dive video (about 2,500-3,000 words of narration)",
};

/**
 * Build the request for a tool. `source` is pre-fetched material (document text,
 * video transcript, page text) supplied by the route for reader tools.
 * Returns { system, content, schema? } where content is a Messages API content array.
 */
export function buildPrompt(tool, input, source) {
  const i = input || {};
  const L = langLine(i.language);

  switch (tool) {
    case "script": {
      const n = niche(i.niche);
      const topic = str(i.topic, "topic", { required: true });
      const length = SCRIPT_LENGTHS[i.length] || SCRIPT_LENGTHS.medium;
      const tone = str(i.tone, "tone", { max: 60 }) || "conversational and energetic";
      return text(
        `Write a complete, ready-to-record script for ${length} in the ${n} niche.\n\nTopic: ${topic}\nTone: ${tone}\n\n` +
        "Structure:\n## Hook (first 5-15 seconds) — pattern interrupt, no channel intro\n## Intro — the promise of the video\n## Main Content — clear sections with on-screen text and B-roll cues in [brackets]\n## Call to Action — natural, mid-video or end\n## Outro — tease the next video\n\n" +
        "Write the narration word-for-word. Optimise for retention: open loops, short sentences, a payoff every 30-60 seconds." + L
      );
    }
    case "video": {
      const idea = str(i.idea, "video idea", { required: true });
      return text(
        `Create a production plan for a faceless YouTube video: ${idea}\n\n` +
        "## Format & Style\n## Voiceover Direction (voice type, pacing, suggested AI voice settings)\n## Scene-by-Scene Shot List (10 scenes: narration summary, visual, stock/AI-image prompt)\n## Music & Sound Design\n## Editing Notes\n## Shorts Repurposing (3 clip ideas with timestamps from the plan)\n## Production Checklist & Time Estimate" + L
      );
    }
    case "thumbnail": {
      const title = str(i.title, "title", { required: true, max: 200 });
      const n = niche(i.niche, false);
      return text(
        `Create 3 distinct high-CTR YouTube thumbnail concepts for the video "${title}" (${n} niche).\n\n` +
        "For each concept use a '## Concept N: Name' heading and include: Layout, Focal subject & emotion, Background, Text overlay (max 4 words), Colour palette with hex codes, an image-generation prompt (Midjourney/DALL·E/Ideogram style), and Why it works.\nEnd with A/B testing advice." + L
      );
    }
    case "titles": {
      const n = niche(i.niche);
      const seed = str(i.seed, "topic seed", { max: 200 }) || "any currently trending topic";
      const style = oneOf(i.style, ["viral", "listicle", "story", "controversial", "howto", "secret"], "viral");
      return {
        ...text(
          `Generate 10 YouTube video titles for the ${n} niche.\nStyle: ${style}. Topic: ${seed}.\n` +
          "Rules: under 60 characters each, high click-through potential, honest (no clickbait the video can't deliver), varied structures." + L
        ),
        schema: TITLES_SCHEMA,
      };
    }
    case "seo": {
      const n = niche(i.niche);
      const topic = str(i.topic, "topic", { required: true });
      return {
        ...text(
          `Build a YouTube SEO package for a ${n} video about: ${topic}.\n` +
          "primary: 3 keywords; secondary: 5; longtail: 5. volume and competition are your relative estimates (low/medium/high).\n" +
          "tags: 15 YouTube tags. hashtags: 3 hashtags including '#'. title_formula: one reusable title template.\n" +
          "description: a full, ready-to-paste YouTube description (hook paragraph, summary, timestamp placeholders, call to action)." + L
        ),
        schema: SEO_SCHEMA,
      };
    }
    case "stickman": {
      const prompt = str(i.prompt, "scene description or script", { required: true, max: 6000 });
      const count = oneOf(Number(i.count), [1, 2, 3, 4, 5, 6], 4);
      const size = STICKMAN_SIZES[i.format] ? i.format : "landscape";
      const [w, h] = STICKMAN_SIZES[size];
      const theme = i.theme === "dark" ? "dark" : "light";
      const captions = Boolean(i.captions);
      return {
        ...text(
          `Create ${count} stickman illustration scene(s) for a faceless YouTube ${size === "portrait" ? "Short" : "video"}.\n\n` +
          `Source (a script, an idea or a scene description):\n<source>\n${prompt}\n</source>\n\n` +
          `If the source is a script, split it into ${count} consecutive beats and illustrate each beat. If it is a single idea, show ${count} different moments or angles of it.\n` +
          "For each scene give: title (2-5 words), narration (the line of voiceover this image sits under, 1-2 sentences), and svg.\n" +
          STICKMAN_STYLE(w, h, theme, captions) + L
        ),
        schema: STICKMAN_SCHEMA,
      };
    }
    case "plan": {
      const n = niche(i.niche);
      const weeks = oneOf(Number(i.weeks), [1, 2, 3, 4], 1);
      const perWeek = oneOf(Number(i.perWeek), [1, 2, 3, 5, 7], 3);
      return text(
        `Create a ${weeks}-week content calendar for a ${n} YouTube channel posting ${perWeek} video(s) per week (${weeks * perWeek} videos total).\n\n` +
        "Use a '## Week N' heading per week. For each video: day, title, hook (first 5 seconds), 3 target keywords, format (long-form or Short), and monetisation angle.\n" +
        "Mix evergreen and trending ideas, and build series that encourage binge-watching. End with a short '## Strategy Notes' section." + L
      );
    }
    case "stats": {
      const c = i.channel || {};
      const fields = [
        ["Channel niche", str(c.niche, "niche", { max: 80 })],
        ["Subscribers", str(String(c.subscribers ?? ""), "subscribers", { max: 20 })],
        ["Monthly views", str(String(c.views ?? ""), "views", { max: 20 })],
        ["Monthly revenue (USD)", str(String(c.revenue ?? ""), "revenue", { max: 20 })],
        ["Videos published", str(String(c.videos ?? ""), "videos", { max: 20 })],
        ["Upload frequency", str(c.frequency, "frequency", { max: 60 })],
        ["Average view duration", str(c.avd, "average view duration", { max: 30 })],
        ["Click-through rate", str(c.ctr, "CTR", { max: 20 })],
        ["Top videos / notes", str(c.notes, "notes", { max: 2000 })],
      ].filter(([, v]) => v);
      if (fields.length < 2) throw new InputError("Add at least a couple of channel stats first.");
      return text(
        "Analyse this YouTube channel and write a growth report.\n\n" +
        fields.map(([k, v]) => `${k}: ${v}`).join("\n") +
        "\n\n## What's Working\n## Red Flags\n## Top 5 Growth Actions (prioritised)\n## Revenue Optimisation\n## 90-Day Targets & Plan\n## 12-Month Projection (conservative / expected / optimistic, clearly labelled estimates)" + L
      );
    }
    case "doc": {
      const mode = oneOf(i.mode, ["summarize", "explain", "keypoints", "video", "ask"], "summarize");
      const q = str(i.question, "question");
      const task = {
        summarize: "Give a clear, structured summary: main topic, key arguments, conclusions.",
        explain: "Explain this in plain, simple English for someone with no background in the topic.",
        keypoints: "List the most important key points as a numbered list.",
        video: "Turn this document into a YouTube video: 5 title options, a hook, and a full section-by-section script outline.",
        ask: q || "What is this document about?",
      }[mode];
      if (source.pdfBase64) {
        return {
          system: SYSTEM,
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: source.pdfBase64 } },
            { type: "text", text: task + L },
          ],
        };
      }
      return text(`<document>\n${source.text}\n</document>\n\n${task}${L}`);
    }
    case "yt": {
      const mode = oneOf(i.mode, ["summarize", "keypoints", "script", "ask"], "summarize");
      const q = str(i.question, "question");
      const task = {
        summarize: "## What It's About\n## Main Points\n## Key Insights\n## Content Style & Format\n## Target Audience",
        keypoints: "List the top 5-7 takeaways and actionable tips, the main argument, and why this video performs.",
        script: "Inspired by this video (do not copy it), give:\n## 3 Original Title Ideas\n## Script Outline for a Better Video\n## Hook Ideas (first 30 seconds)\n## Thumbnail Concepts\n## How to Differentiate",
        ask: "Answer this question about the video: " + (q || "What is this video about and who is it for?"),
      }[mode];
      return text(`Here is the source material for a YouTube video.\n\n${source.text}\n\n${task}${L}`);
    }
    case "url": {
      const mode = oneOf(i.mode, ["summarize", "keypoints", "competitor", "ask"], "summarize");
      const q = str(i.question, "question");
      const task = {
        summarize: "## What It's About\n## Main Message\n## Target Audience\n## Key Information\n## Quality Assessment",
        keypoints: "List the top 5-7 key points, calls to action, and the unique value proposition.",
        competitor: "Write a competitor analysis:\n## What They Do\n## Strengths\n## Weaknesses\n## Monetisation\n## Content & SEO Strategy\n## How to Compete & Do Better\n## 5 YouTube Video Ideas That Beat Them",
        ask: "Answer this question about the page: " + (q || "What is this website about?"),
      }[mode];
      return text(`Here is the extracted content of a web page.\n\n${source.text}\n\n${task}${L}`);
    }
    default:
      throw new InputError("Unknown tool.");
  }
}

function text(prompt) {
  return { system: SYSTEM, content: [{ type: "text", text: prompt }] };
}

export const TOOLS = ["stickman", "script", "video", "thumbnail", "titles", "seo", "plan", "stats", "doc", "yt", "url"];
