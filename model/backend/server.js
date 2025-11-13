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

// ---------------- Helpers ----------------
function tryParseJSON(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    const j = s.match(/\{[\s\S]*\}/);
    if (j) {
      try {
        return JSON.parse(j[0]);
      } catch {}
    }
    return null;
  }
}

// Extract text from @google/genai response
function extractTextFromGC(gc) {
  if (!gc) return "";
  if (typeof gc.text === "string" && gc.text) return gc.text;
  const cand = gc?.candidates?.[0];
  if (cand?.content?.parts?.length) {
    return cand.content.parts
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("");
  }
  return "";
}

// CJK single-char check
function isSingleCJKChar(s) {
  if (!s || typeof s !== "string") return false;
  const chars = Array.from(s.trim());
  if (chars.length !== 1) return false;
  const cp = chars[0].codePointAt(0);
  // CJK Unified + Extension A + Compatibility Ideographs
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

// Minimal built-in glossary for common characters (short glosses)
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

// Doodle detector (server-side safety cap)
function looksLikeDoodle(recognized) {
  const r = (recognized || "").toLowerCase();
  return (
    !isSingleCJKChar(recognized) ||
    /circle|dot|blob|scribble|unknown|\?/.test(r) ||
    recognized === "●" ||
    recognized === "○"
  );
}

// Estimate dominant stroke angle via simple PCA (0°=horizontal, 90°=vertical)
async function estimateStrokeAngleFromDataURL(dataUrl) {
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  const img = sharp(buf).greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info; // channels=1 (greyscale)
  if (!width || !height || !data?.length) return null;

  // Global threshold (mean)
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;
  const thr = Math.max(0, Math.min(255, mean - 10));

  const pts = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = data[y * width + x];
      if (v < thr) pts.push([x, y]);
    }
  }
  if (pts.length < 50) return null;

  // PCA on (x,y)
  let mx = 0,
    my = 0;
  for (const [x, y] of pts) {
    mx += x;
    my += y;
  }
  mx /= pts.length;
  my /= pts.length;
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const [x, y] of pts) {
    const dx = x - mx,
      dy = y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= pts.length;
  syy /= pts.length;
  sxy /= pts.length;
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy); // radians in [-π/2, π/2]
  let deg = Math.abs((theta * 180) / Math.PI); // [0, 90]
  if (deg > 90) deg = 180 - deg;
  return { angleDeg: deg, width, height, points: pts.length };
}

// Target-aware orientation rule
function orientationMismatch(target, angleDeg) {
  if (!Number.isFinite(angleDeg)) return false;
  const t = (target || "").trim();
  const H_TOL = 20; // horizontal tolerance
  const V_TOL = 20; // vertical tolerance
  if (t === "一") return angleDeg > H_TOL; // expect ~0°
  if (t === "丨") return Math.abs(90 - angleDeg) > V_TOL; // expect ~90°
  return false;
}

// Final score logic with doodle + mismatch caps
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

  if (isDoodle) score = Math.min(score, 5); // doodle: ≤5
  if (targetChar && !match) score = Math.min(score, 10); // mismatch: ≤10

  return score;
}

async function callModel({
  base64,
  mimeType,
  target,
  maxTokens,
  feedbackMax,
  extraInstruction = "",
  userStrokeCount = null,
}) {
  const systemInstruction = `
CRITICAL TASK (STRICT handwriting grading):
You are a strict Chinese calligraphy teacher. Be HARSH but fair.

1) Recognize the single Chinese character drawn.
2) Provide definition for recognized character.
3) **IMMEDIATELY check stroke count** - this is THE MOST IMPORTANT rule.

STROKE COUNT RULES (ABSOLUTELY ENFORCED):
- Chinese characters have EXACT stroke counts. This is non-negotiable.
- If user drew fewer strokes than required: CHARACTER IS INCOMPLETE
  * Missing 1 stroke: score ≤ 40, feedback MUST say "incomplete - missing X stroke(s)"
  * Missing 2+ strokes: score ≤ 20, feedback MUST say "severely incomplete"
- If user drew more strokes than required: score ≤ 30, say "too many strokes"
- ONLY if stroke count is correct: grade quality (structure, stroke quality, proportion)

SCORING (be strict, most students should get 60-75):
- Incomplete character (wrong stroke count): AUTO-CAP as above, explain why
- Wrong character (recognized != target): score ≤ 10
- Doodle/scribble/not hanzi: score ≤ 5
- Correct character, correct strokes, but poor quality: 50-70
- Correct character, correct strokes, good quality: 70-85
- Correct character, correct strokes, excellent: 85-95
- Perfect calligraphy (rare): 95-100

FEEDBACK RULES:
- If stroke count wrong: MUST mention this FIRST ("incomplete, needs X more strokes")
- Be specific about what's actually wrong
- Don't give praise if the character is incomplete
- Maximum ${feedbackMax} characters

${extraInstruction}`.trim();

  const strokeInfo =
    userStrokeCount !== null
      ? `\n\n**CRITICAL INFO**: User drew exactly ${userStrokeCount} stroke(s). You MUST check if this matches the required stroke count for the target character '${target}'.`
      : "";

  const userPrompt = `
Target character: '${target || "(none)"}'${strokeInfo}

BEFORE grading quality, CHECK: Does the stroke count match what '${target}' requires?

Return STRICT JSON:
{
  "recognized": "<character or 'incomplete'>",
  "definition": "<meaning>",
  "target_match": true|false,
  "mismatch_reason": "<if false>",
  "subscores": { 
    "structure": 0-60,
    "strokes": 0-20,
    "proportion": 0-20
  },
  "score": 0-100,
  "feedback": "<<=${feedbackMax} chars - if incomplete, say so FIRST>",
  "is_doodle": true|false,
  "recognition_confidence": 0.0-1.0,
  "stroke_estimate": 0,
  "stroke_count_correct": true|false
}`.trim();

  const gc = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: userPrompt },
        ],
      },
    ],
    systemInstruction,
    generationConfig: {
      temperature: 0.05, // Even lower for consistency
      candidateCount: 1,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          recognized: { type: "string", maxLength: 12 },
          definition: { type: "string", maxLength: 64 },
          target_match: { type: "boolean" },
          mismatch_reason: { type: "string", maxLength: 80 },
          subscores: {
            type: "object",
            additionalProperties: false,
            properties: {
              structure: { type: "number", minimum: 0, maximum: 60 },
              strokes: { type: "number", minimum: 0, maximum: 20 },
              proportion: { type: "number", minimum: 0, maximum: 20 },
            },
          },
          score: { type: "number", minimum: 0, maximum: 100 },
          feedback: { type: "string", maxLength: feedbackMax },
          is_doodle: { type: "boolean" },
          recognition_confidence: { type: "number", minimum: 0, maximum: 1 },
          stroke_estimate: { type: "integer", minimum: 0 },
          stroke_count_correct: { type: "boolean" },
        },
        required: [
          "recognized",
          "definition",
          "target_match",
          "score",
          "feedback",
          "stroke_estimate",
        ],
      },
    },
  });

  const finishReason = gc?.candidates?.[0]?.finishReason || null;
  const textOut = extractTextFromGC(gc);
  return { textOut, finishReason, promptFeedback: gc?.promptFeedback || null };
}

// Always fill a definition if missing.
// - If recognized is a known hanzi in GLOSS: use it.
// - If recognized is a hanzi but not in GLOSS: ask model (short JSON).
// - If not a valid hanzi: return "not a valid Chinese character".
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
    systemInstruction:
      "Reply only valid JSON with a concise 'definition' field.",
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

// ---------------- Route ----------------
app.post("/api/eval-handwriting", async (req, res) => {
  try {
    const { image, target, StrokeCount, strokeCount } = req.body || {};
    const userStrokeCount = Number.isFinite(Number(StrokeCount))
      ? Number(StrokeCount)
      : Number.isFinite(Number(strokeCount))
      ? Number(strokeCount)
      : null;

    if (
      !image ||
      typeof image !== "string" ||
      !image.startsWith("data:image")
    ) {
      return res.status(400).json({
        error: "bad_request",
        detail: "Expected a data URL image in 'image'.",
      });
    }
    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "server_config",
        detail: "Missing GOOGLE_API_KEY (or GEMINI_API_KEY).",
      });
    }

    const m = image.match(/^data:(.+?);base64,(.*)$/);
    if (!m)
      return res
        .status(400)
        .json({ error: "bad_request", detail: "Invalid data URL format." });
    const mimeType = m[1];
    const base64 = m[2];

    // Orientation estimate (server-side)
    const orient = await estimateStrokeAngleFromDataURL(image).catch(
      () => null
    );
    const orientHint = orient
      ? `Orientation: estimated dominant stroke angle ≈ ${orient.angleDeg.toFixed(
          1
        )}°. 
         If target is '一', only near-horizontal (≤20°) is acceptable; 
         if target is '丨', only near-vertical (≥70°) is acceptable.`
      : "";

    // Attempt 1
    let { textOut, finishReason, promptFeedback } = await callModel({
      base64,
      mimeType,
      target,
      maxTokens: DEFAULT_MAX_TOKENS,
      feedbackMax: FEEDBACK_MAX,
      extraInstruction: orientHint,
      userStrokeCount,
    });

    let parsed = tryParseJSON(textOut);

    const needRetry =
      finishReason === "MAX_TOKENS" ||
      !textOut ||
      !textOut.trim() ||
      !parsed ||
      !parsed.feedback;

    if (needRetry) {
      // Attempt 2 (larger cap, tighter feedback)
      const again = await callModel({
        base64,
        mimeType,
        target,
        maxTokens: RETRY_MAX_TOKENS,
        feedbackMax: RETRY_FEEDBACK_MAX,
        extraInstruction:
          (orientHint ? `${orientHint}\n` : "") +
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
        detail:
          finishReason === "MAX_TOKENS"
            ? "The model hit its maximum output tokens twice."
            : "The model returned no text.",
        finishReason,
        promptFeedback,
      });
    }

    // ---- Guarantee 'definition' ----
    if (!parsed?.definition || !parsed.definition.trim()) {
      // Always fill — if non-hanzi, we'll put the explicit notice
      parsed.definition = await ensureDefinition(parsed?.recognized || "");
    }

    // Compute score + orientation penalty
    let finalScore = computeFinalScore(parsed, target);

    let orientation_ok = true;
    let orientation_note;
    if (orient && orientationMismatch(target, orient.angleDeg)) {
      orientation_ok = false;
      orientation_note = `Expected orientation for '${(
        target || ""
      ).trim()}'; dominant angle ${orient.angleDeg.toFixed(
        1
      )}° indicates mismatch.`;
      finalScore = Math.min(finalScore, 10);
    }
    if (
      Number.isFinite(userStrokeCount) &&
      parsed?.stroke_count_correct === false
    ) {
      const est = Number.isFinite(Number(parsed?.stroke_estimate))
        ? Number(parsed.stroke_estimate)
        : null;
      const tooFew = est == null ? true : userStrokeCount < est;
      // Cap score: fewer strokes → ≤20 (incomplete), extra strokes → ≤30
      finalScore = Math.min(finalScore, tooFew ? 20 : 30);
      // Prepend a clear feedback message
      const missing = est != null ? Math.max(0, est - userStrokeCount) : null;
      const prefix =
        missing && missing > 0
          ? `Incomplete — missing ${missing} stroke(s). `
          : `Wrong stroke count. `;
      parsed.feedback = prefix + (parsed?.feedback || "");
    }

    const out = {
      score: finalScore,
      recognized: parsed?.recognized ?? undefined,
      definition: parsed?.definition ?? undefined, // <-- always present now
      feedback:
        parsed?.feedback ??
        parsed?.reason ??
        (textOut ? String(textOut).slice(0, 400) : undefined),
      target_match:
        parsed?.target_match === true ||
        (parsed?.recognized || "").trim() === (target || "").trim(),
      mismatch_reason: parsed?.mismatch_reason || undefined,
      is_doodle:
        parsed?.is_doodle === true || looksLikeDoodle(parsed?.recognized),
      recognition_confidence: Number(parsed?.recognition_confidence ?? NaN),
      stroke_estimate: Number.isFinite(Number(parsed?.stroke_estimate))
        ? Number(parsed.stroke_estimate)
        : undefined,
      stroke_count_correct:
        typeof parsed?.stroke_count_correct === "boolean"
          ? parsed.stroke_count_correct
          : undefined,
      dominant_angle_deg: orient?.angleDeg,
      orientation_ok,
      orientation_note,
      raw: textOut,
      model: MODEL,
      finishReason: finishReason || undefined,
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
    return res
      .status(500)
      .json({ error: "server_error", detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
