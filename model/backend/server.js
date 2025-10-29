// server.js
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// -------- Model & token settings --------
const MODEL =
  process.env.GEMINI_MODEL ||
  process.env.GOOGLE_GENAI_MODEL ||
  "gemini-2.5-flash-lite";

const DEFAULT_MAX_TOKENS = Number(process.env.GEN_MAX_TOKENS) || 2048;
const RETRY_MAX_TOKENS = Number(process.env.GEN_RETRY_TOKENS) || 8192;

const FEEDBACK_MAX = Number(process.env.FEEDBACK_MAX_CHARS) || 220;
const RETRY_FEEDBACK_MAX = Math.min(FEEDBACK_MAX, 180);

// Google GenAI client (v1beta)
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
});

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL }));

// ---------------- Target metadata ----------------
const TARGET_META = Object.freeze({
  "一": { strokes: 1, cues: "single horizontal stroke; no vertical; ~0°" },
  "丨": { strokes: 1, cues: "single vertical stroke; no horizontal; ~90°" },
  "十": { strokes: 2, cues: "one vertical + one horizontal crossing near center" },
  "七": { strokes: 2, cues: "short top-left horizontal tick + long descending stroke with small hook; NOT a rigid 90° 'L'" },
  "二": { strokes: 2, cues: "two separated parallel horizontals; top shorter than bottom; no connecting vertical" },
  "三": { strokes: 3, cues: "three separated parallel horizontals; middle shortest; no connecting vertical" },
  // add more as needed…
});

const HORIZONTAL_ONLY = new Set(["一", "二", "三"]);
const VERTICAL_ONLY   = new Set(["丨"]);

// ---------------- Helpers ----------------
function tryParseJSON(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    const j = s.match(/\{[\s\S]*\}/);
    if (j) {
      try { return JSON.parse(j[0]); } catch {}
    }
    return null;
  }
}

function metaForTarget(t) {
  const c = (t || "").trim();
  return TARGET_META[c] || null;
}

function extractTextFromGC(gc) {
  if (!gc) return "";
  if (typeof gc.text === "string" && gc.text) return gc.text;
  const cand = gc?.candidates?.[0];
  if (cand?.content?.parts?.length) {
    return cand.content.parts.map(p => (typeof p.text === "string" ? p.text : "")).join("");
  }
  return "";
}

function isSingleCJKChar(s) {
  if (!s || typeof s !== "string") return false;
  const chars = Array.from(s.trim());
  if (chars.length !== 1) return false;
  const cp = chars[0].codePointAt(0);
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

const GLOSS = Object.freeze({
  一: "one; horizontal stroke",
  丨: "vertical stroke",
  十: "ten; cross shape",
  人: "person; human",
  口: "mouth; opening",
  大: "big; great",
  小: "small; little",
  中: "middle; center",
  上: "up; above",
  下: "down; below",
  日: "sun; day",
  月: "moon; month",
  山: "mountain",
  水: "water",
  火: "fire",
});

function looksLikeDoodle(recognized) {
  const r = (recognized || "").toLowerCase();
  return (
    !isSingleCJKChar(recognized) ||
    /circle|dot|blob|scribble|unknown|\?/.test(r) ||
    recognized === "●" || recognized === "○"
  );
}

// ---------- Ink analyzer: dominant angle + horizontal/vertical band counts ----------
async function analyzeInkFromDataURL(dataUrl) {
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return null;

  const buf = Buffer.from(m[2], "base64");
  const img = sharp(buf).greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (!width || !height || !data?.length) return null;

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;
  const thr = Math.max(0, Math.min(255, mean - 10));

  const rowHasInk = new Array(height).fill(false);
  const colHasInk = new Array(width).fill(false);
  const pts = [];

  for (let y = 0; y < height; y++) {
    let rowInk = false;
    for (let x = 0; x < width; x++) {
      const v = data[y * width + x];
      if (v < thr) {
        rowInk = true;
        colHasInk[x] = true;
        pts.push([x, y]);
      }
    }
    rowHasInk[y] = rowInk;
  }
  if (pts.length < 50) return null;

  // PCA angle (0° horizontal, 90° vertical)
  let mx = 0, my = 0;
  for (const [x, y] of pts) { mx += x; my += y; }
  mx /= pts.length; my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) {
    const dx = x - mx, dy = y - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  sxx /= pts.length; syy /= pts.length; sxy /= pts.length;
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let angleDeg = Math.abs(theta * 180 / Math.PI);
  if (angleDeg > 90) angleDeg = 180 - angleDeg;

  function fillSmallGaps(arr, maxGap = 2) {
    const n = arr.length;
    let i = 0;
    while (i < n) {
      while (i < n && arr[i]) i++;
      let j = i;
      while (j < n && !arr[j]) j++;
      const gap = j - i;
      if (gap > 0 && gap <= maxGap) for (let k = i; k < j; k++) arr[k] = true;
      i = j;
    }
    return arr;
  }
  function countBands(arr, minBand = 2) {
    let bands = 0, run = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) run++; else { if (run >= minBand) bands++; run = 0; }
    }
    if (run >= minBand) bands++;
    return bands;
  }

  fillSmallGaps(rowHasInk, 2);
  fillSmallGaps(colHasInk, 2);
  const rowBands = countBands(rowHasInk, 2);
  const colBands = countBands(colHasInk, 2);

  return { angleDeg, width, height, points: pts.length, rowBands, colBands };
}

function orientationMismatch(target, angleDeg) {
  if (!Number.isFinite(angleDeg)) return false;
  const t = (target || "").trim();
  const H_TOL = 20;
  const V_TOL = 20;

  if (t === "一" || t === "二" || t === "三") return angleDeg > H_TOL;
  if (t === "丨") return Math.abs(90 - angleDeg) > V_TOL;
  return false;
}

function computeFinalScore(parsed, target) {
  const targetChar = (target || "").trim();
  const rec = (parsed?.recognized || "").trim();
  const modelMatch = parsed?.target_match === true;
  const literalMatch = targetChar && rec && rec === targetChar;
  const match = modelMatch || literalMatch;

  let score = Number.isFinite(Number(parsed?.score)) ? Number(parsed.score) : 0;
  score = Math.max(0, Math.min(100, score));

  const conf = Number(parsed?.recognition_confidence);
  const isDoodle =
    parsed?.is_doodle === true ||
    looksLikeDoodle(rec) ||
    (Number.isFinite(conf) && conf < 0.45);

  if (isDoodle) score = Math.min(score, 5);
  if (targetChar && !match) score = Math.min(score, 10);
  return score;
}

async function callModel({ base64, mimeType, target, maxTokens, feedbackMax, extraInstruction = "" }) {
  const systemInstruction = `
TASK (strict target-aware handwriting grading):
1) Recognize the single handwritten Chinese character (top-1) ONLY if confident it's a valid hanzi.
2) Provide a short dictionary-style definition.
3) Judge ONLY vs the given target.

DO NOT over-match:
- If drawing is an L-corner, circle, blob, or line-with-hook that does NOT fit the target, set:
  valid_hanzi=false (or true if it is a hanzi but not target), target_match=false, and cap score.
- You MUST output structural flags so the grader can veto misrecognitions.

VETO CONDITIONS (must obey):
- If target=='一':
  * stroke_estimate MUST equal 1
  * has_vertical_segment MUST be false
  * corner_like MUST be false
  * hook_present MUST be false
  If any fail → target_match=false and score ≤ 5.

- If target=='丨':
  * stroke_estimate MUST equal 1
  * has_horizontal_segment MUST be false
  * corner_like MUST be false
  * hook_present MUST be false
  If any fail → target_match=false and score ≤ 5.

SCORING (decimals allowed):
- If target_match=true: score = structure(0–60)+strokes(0–20)+proportion(0–20).
- If target_match=false: score ≤ 10 (≤5 for obvious non-target shapes).
- Keep "feedback" ≤ ${feedbackMax} chars, concise and target-specific.
- Output ONLY JSON conforming to schema.
${extraInstruction}`.trim();

  const userPrompt = `
Target: ${target || "(none)"}.

Return STRICT JSON:
{
  "recognized": "<top1 or 'not a valid Chinese character'>",
  "definition": "<short gloss; or 'not a valid Chinese character'>",
  "valid_hanzi": true|false,
  "target_match": true|false,
  "mismatch_reason": "<why>",

  "stroke_estimate": 0,
  "shape_flags": {
    "has_vertical_segment": true|false,
    "has_horizontal_segment": true|false,
    "corner_like": true|false,
    "hook_present": true|false
  },

  "subscores": { "structure": 0-60, "strokes": 0-20, "proportion": 0-20 },
  "recognition_confidence": 0.0-1.0,
  "is_doodle": true|false,
  "score": 0-100,
  "feedback": "<<=${feedbackMax} chars>"
}`.trim();

  const gc = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ inlineData: { data: base64, mimeType } }, { text: userPrompt }] }],
    systemInstruction,
    generationConfig: {
      temperature: 0.08,
      candidateCount: 1,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          recognized: { type: "string", maxLength: 16 },
          definition: { type: "string", maxLength: 64 },
          valid_hanzi: { type: "boolean" },
          target_match: { type: "boolean" },
          mismatch_reason: { type: "string", maxLength: 160 },
          stroke_estimate: { type: "integer", minimum: 0 },
          shape_flags: {
            type: "object",
            additionalProperties: false,
            properties: {
              has_vertical_segment: { type: "boolean" },
              has_horizontal_segment: { type: "boolean" },
              corner_like: { type: "boolean" },
              hook_present: { type: "boolean" }
            },
            required: ["has_vertical_segment","has_horizontal_segment","corner_like","hook_present"]
          },
          subscores: {
            type: "object",
            additionalProperties: false,
            properties: {
              structure: { type: "number", minimum: 0, maximum: 60 },
              strokes:   { type: "number", minimum: 0, maximum: 20 },
              proportion:{ type: "number", minimum: 0, maximum: 20 }
            }
          },
          recognition_confidence: { type: "number", minimum: 0, maximum: 1 },
          is_doodle: { type: "boolean" },
          score: { type: "number", minimum: 0, maximum: 100 },
          feedback: { type: "string", maxLength: feedbackMax }
        },
        required: ["recognized","definition","valid_hanzi","target_match","score","feedback","stroke_estimate","shape_flags"]
      }
    }
  });

  const finishReason = gc?.candidates?.[0]?.finishReason || null;
  const textOut = extractTextFromGC(gc);
  return { textOut, finishReason, promptFeedback: gc?.promptFeedback || null };
}

async function ensureDefinition(recognizedChar, maxTokens = 256) {
  const c = (recognizedChar || "").trim();
  if (!isSingleCJKChar(c)) return "not a valid Chinese character";
  if (GLOSS[c]) return GLOSS[c];

  const prompt = `
Provide a short dictionary-style gloss for the single Chinese character "${c}".
Return STRICT JSON:
{ "definition": "<<=64 chars concise meaning in English>" }`.trim();

  const gc = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: "Reply only valid JSON with a concise 'definition' field.",
    generationConfig: {
      temperature: 0.1,
      candidateCount: 1,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        additionalProperties: false,
        properties: { definition: { type: "string", maxLength: 64 } },
        required: ["definition"],
      },
    },
  });

  const t = extractTextFromGC(gc);
  const j = tryParseJSON(t);
  const def = (j?.definition || "").trim();
  return def || "a Chinese character";
}

// ---------- Generic hard veto (stroke-count, bands, family rules) ----------
function vetoByStrokesAndShape({
  target, needStrokes, modelStrokeEstimate, flags, userStrokeCount, bandInfo
}) {
  const t = (target || "").trim();
  const strokesNeeded = Number(needStrokes) || null;
  const userStrokes   = Number.isFinite(Number(userStrokeCount)) ? Number(userStrokeCount) : null;
  const modelStrokes  = Number.isFinite(Number(modelStrokeEstimate)) ? Number(modelStrokeEstimate) : null;
  const f = flags || {};
  const rows = bandInfo?.rowBands ?? null;
  const cols = bandInfo?.colBands ?? null;

  // Stroke-count
  if (strokesNeeded && strokesNeeded > 0) {
    if (userStrokes !== null && userStrokes < strokesNeeded) {
      return `Target '${t}' requires ≥${strokesNeeded} strokes; user drew ${userStrokes}.`;
    }
    if (userStrokes === null && modelStrokes !== null && modelStrokes < strokesNeeded) {
      return `Target '${t}' requires ≥${strokesNeeded} strokes; estimated ~${modelStrokes}.`;
    }
  }

  // Horizontal-only (一/二/三): require separated horizontal bands
  if (HORIZONTAL_ONLY.has(t) && strokesNeeded && rows !== null && rows < strokesNeeded) {
    return `'${t}' requires ${strokesNeeded} separate horizontal lines; detected ${rows}.`;
  }
  if (HORIZONTAL_ONLY.has(t)) {
    if (f.has_vertical_segment === true) return `'${t}' should not contain a vertical segment.`;
    if (f.corner_like === true)          return `Rigid 90° corner is not a valid '${t}'.`;
    if (f.hook_present === true)         return `'${t}' should not have a hook.`;
  }

  // Vertical-only (丨)
  if (VERTICAL_ONLY.has(t)) {
    if (f.has_horizontal_segment === true) return `'${t}' should not contain a horizontal segment.`;
    if (f.corner_like === true)            return `Rigid 90° corner is not a valid '${t}'.`;
    if (f.hook_present === true)           return `'${t}' should not have a hook.`;
    if (strokesNeeded && cols !== null && cols < 1) {
      return `'${t}' requires a clear vertical line; detected ${cols} vertical lines.`;
    }
  }

  // Special guard for 七 as single rigid L
  if (t === "七" && f.corner_like === true) return "Single-stroke rigid 'L' is not a valid '七'.";
  return null;
}

// ---------------- Route ----------------
app.post("/api/eval-handwriting", async (req, res) => {
  try {
    const { image, target, userStrokeCount } = req.body || {};
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return res.status(400).json({ error: "bad_request", detail: "Expected a data URL image in 'image'." });
    }
    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "server_config", detail: "Missing GOOGLE_API_KEY (or GEMINI_API_KEY)." });
    }

    const m = image.match(/^data:(.+?);base64,(.*)$/);
    if (!m) return res.status(400).json({ error: "bad_request", detail: "Invalid data URL format." });
    const mimeType = m[1];
    const base64 = m[2];

    // Analyze ink
    const ink = await analyzeInkFromDataURL(image).catch(() => null);
    const orientHint = ink
      ? `Orientation: estimated dominant stroke angle ≈ ${ink.angleDeg.toFixed(1)}°.
         If target is '一', '二', or '三', only near-horizontal (≤20°) is acceptable;
         if target is '丨', only near-vertical (≥70°) is acceptable.`
      : "";

    // Target meta + family hints
    const meta = metaForTarget(target);
    const needs = meta?.strokes;
    const horizontalHint = HORIZONTAL_ONLY.has((target || "").trim())
      ? `For '${target}', prefer purely horizontal structure: has_vertical_segment=false, corner_like=false, hook_present=false.`
      : "";
    const verticalHint = VERTICAL_ONLY.has((target || "").trim())
      ? `For '${target}', prefer purely vertical structure: has_horizontal_segment=false, corner_like=false, hook_present=false.`
      : "";

    const metaHint = meta ? `
STRICT TARGET META:
- Expected strokes for '${target}': ${needs}.
- Cues: ${meta.cues}.
- If your stroke_estimate < ${needs}, you MUST set target_match=false and keep score ≤5.
${horizontalHint}
${verticalHint}
`.trim() : "";

    // Attempt 1
    let { textOut, finishReason, promptFeedback } = await callModel({
      base64, mimeType, target,
      maxTokens: DEFAULT_MAX_TOKENS,
      feedbackMax: FEEDBACK_MAX,
      extraInstruction: [orientHint || "", metaHint || ""].filter(Boolean).join("\n"),
    });

    let parsed = tryParseJSON(textOut);

    const needRetry =
      finishReason === "MAX_TOKENS" ||
      !textOut || !textOut.trim() ||
      !parsed || !parsed.feedback;

    if (needRetry) {
      const again = await callModel({
        base64, mimeType, target,
        maxTokens: RETRY_MAX_TOKENS,
        feedbackMax: RETRY_FEEDBACK_MAX,
        extraInstruction:
          (orientHint ? `${orientHint}\n` : "") +
          (metaHint ? `${metaHint}\n` : "") +
          "If you cannot fit within limits, prioritize valid JSON. For mismatch, keep score ≤10 and feedback ultra-concise.",
      });
      textOut = again.textOut || textOut;
      finishReason = again.finishReason || finishReason;
      promptFeedback = again.promptFeedback || promptFeedback;
      parsed = tryParseJSON(textOut);
    }

    if (!textOut || !textOut.trim()) {
      return res.status(502).json({
        error: "model_no_content",
        detail: finishReason === "MAX_TOKENS"
          ? "The model hit its maximum output tokens twice."
          : "The model returned no text.",
        finishReason,
        promptFeedback,
      });
    }

    // Ensure definition
    if (!parsed?.definition || !parsed.definition.trim()) {
      parsed.definition = await ensureDefinition(parsed?.recognized || "");
    }

    // Local target_match + hard veto
    const recChar = (parsed?.recognized || "").trim();
    let targetMatch = parsed?.target_match === true || (recChar && target && recChar === target);

    const vetoMsg = vetoByStrokesAndShape({
      target,
      needStrokes: needs ?? null,
      modelStrokeEstimate: Number(parsed?.stroke_estimate),
      flags: parsed?.shape_flags || {},
      userStrokeCount: Number(userStrokeCount),
      bandInfo: { rowBands: ink?.rowBands, colBands: ink?.colBands },
    });

    if (vetoMsg) {
      targetMatch = false;
      parsed.mismatch_reason =
        (parsed?.mismatch_reason ? parsed.mismatch_reason + " | " : "") + vetoMsg;
    }
    parsed.target_match = targetMatch;

    // Score (+caps)
    let finalScore = computeFinalScore(parsed, target);
    if (vetoMsg) finalScore = Math.min(finalScore, 5);

    let orientation_ok = true;
    let orientation_note;
    if (ink && orientationMismatch(target, ink.angleDeg)) {
      orientation_ok = false;
      orientation_note = `Expected orientation for '${(target || "").trim()}'; dominant angle ${ink.angleDeg.toFixed(1)}° indicates mismatch.`;
      finalScore = Math.min(finalScore, 10);
    }

    // -------- Override feedback/recognized when veto triggers --------
    const feedbackFinal = vetoMsg
      ? `Not accepted for '${target}': ${vetoMsg}${
          needs ? ` (expected ≥${needs} strokes)` : ""
        }${meta?.cues ? ` · Tip: ${meta.cues}` : ""}`
      : (parsed?.feedback ??
         parsed?.reason ??
         (textOut ? String(textOut).slice(0, 400) : "—"));

    const recognizedFinal = targetMatch ? (parsed?.recognized ?? "—") : "—";

    // -------- Response --------
    const out = {
      score: finalScore,
      recognized: recognizedFinal,
      definition: parsed?.definition ?? undefined,
      feedback: feedbackFinal,
      target_match: targetMatch,
      mismatch_reason: parsed?.mismatch_reason || undefined,
      is_doodle: parsed?.is_doodle === true || looksLikeDoodle(parsed?.recognized),
      recognition_confidence: Number(parsed?.recognition_confidence ?? NaN),
      stroke_estimate: Number.isFinite(Number(parsed?.stroke_estimate))
        ? Number(parsed.stroke_estimate)
        : undefined,
      user_strokes: Number.isFinite(Number(userStrokeCount)) ? Number(userStrokeCount) : undefined,
      dominant_angle_deg: ink?.angleDeg,
      orientation_ok,
      orientation_note,
      raw: textOut,
      model: MODEL,
      finishReason: finishReason || undefined,
      veto: Boolean(vetoMsg),
      expected_strokes: needs ?? undefined,
    };

    if (!out.feedback) {
      return res.status(502).json({
        error: "bad_json",
        detail: "Missing 'feedback'.",
        raw: textOut,
        finishReason,
      });
    }

    return res.json(out);
  } catch (e) {
    if (e?.status === 429 || e?.error?.status === "RESOURCE_EXHAUSTED") {
      return res.status(429).json({
        error: "quota_exceeded",
        detail: "Rate or daily quota exceeded. Try later or switch model/tier.",
      });
    }
    console.error(e);
    return res.status(500).json({ error: "server_error", detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
