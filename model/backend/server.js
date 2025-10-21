import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

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
const RETRY_MAX_TOKENS   = Number(process.env.GEN_RETRY_TOKENS) || 8192;

const FEEDBACK_MAX       = Number(process.env.FEEDBACK_MAX_CHARS) || 220;
const RETRY_FEEDBACK_MAX = Math.min(FEEDBACK_MAX, 180);

// Use beta so camelCase config works
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, model: MODEL })
);

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

// Basic CJK single-char check
function isSingleCJKChar(s) {
  if (!s || typeof s !== "string") return false;
  const chars = Array.from(s.trim());
  if (chars.length !== 1) return false;
  const cp = chars[0].codePointAt(0);
  // CJK Unified + Extension A + Compatibility Ideographs
  return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0xF900 && cp <= 0xFAFF);
}

// Heuristic doodle detector for server-side safety caps
function looksLikeDoodle(recognized) {
  const r = (recognized || "").toLowerCase();
  return (
    !isSingleCJKChar(recognized) ||
    /circle|dot|blob|scribble|unknown|\?/.test(r) ||
    recognized === "●" ||
    recognized === "○"
  );
}

function computeFinalScore(parsed, target) {
  const targetChar = (target || "").trim();
  const rec = (parsed?.recognized || "").trim();

  // If model supplies boolean, use it; else literal equality
  const modelMatch = parsed?.target_match === true;
  const literalMatch = targetChar && rec && rec === targetChar;
  const match = modelMatch || literalMatch;

  // Start from model score (float allowed), clamp to [0,100]
  let score = Number.isFinite(Number(parsed?.score)) ? Number(parsed.score) : 0;
  score = Math.max(0, Math.min(100, score));

  // Doodle guard: non-hanzi/circle/blob OR very low confidence
  const conf = Number(parsed?.recognition_confidence);
  const isDoodle =
    parsed?.is_doodle === true ||
    looksLikeDoodle(rec) ||
    (Number.isFinite(conf) && conf < 0.45);

  if (isDoodle) {
    score = Math.min(score, 5); // brutal cap for doodles
  }

  // Target-aware guard: mismatch => hard cap
  if (targetChar && !match) {
    score = Math.min(score, 10);
  }

  return score;
}

async function callModel({
  base64,
  mimeType,
  target,
  maxTokens,
  feedbackMax,
  extraInstruction = "",
}) {
  // Tight, target-aware, decimal scoring with doodle handling
  // tell the model to handle the horizontal or vertical cases, where the input direction is important.
  const systemInstruction = `
TASK (target-aware handwriting grading):
1) Recognize the single Chinese character (top-1).
2) Provide a short dictionary-style **definition** for the recognized character.
3) Compare ONLY to the provided target character.

SCORING (decimals allowed):
- If recognized != target (consider canonical simp/trad equivalents), set target_match=false and cap score ≤ 10.
- If recognized == target, grade strictly:
  structure (0–60), strokes (0–20), proportion (0–20); sum = score (0–100). Decimals OK (e.g., 81.5).
- If the drawing is NOT a valid Chinese character (circle/thick dot/scribble), set is_doodle=true and cap score ≤ 5.
- Keep "feedback" concise (≤ ${feedbackMax} chars), actionable, and target-specific.
- Reply ONLY valid JSON. No extra text.
${extraInstruction}`.trim();

  const userPrompt = `
Target: ${target || "(none)"}.
Return STRICT JSON:
{
  "recognized": "<top1 or short description if not a valid hanzi>",
  "definition": "<short gloss for recognized char; if not a hanzi, say 'not a valid Chinese character'>",
  "target_match": true|false,
  "mismatch_reason": "<why>",                  // required if target_match=false
  "subscores": { "structure": 0-60, "strokes": 0-20, "proportion": 0-20 },
  "score": 0-100,                              // decimals allowed
  "feedback": "<<=${feedbackMax} chars>",
  "is_doodle": true|false,                     // true for circle/dot/scribble/non-hanzi
  "recognition_confidence": 0.0-1.0,           // model's confidence in recognized
  "stroke_estimate": 0                          // integer estimate (best effort)
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
    config: {
      systemInstruction,
      temperature: 0.15,
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
              strokes:   { type: "number", minimum: 0, maximum: 20 },
              proportion:{ type: "number", minimum: 0, maximum: 20 }
            }
          },
          score: { type: "number", minimum: 0, maximum: 100 },
          feedback: { type: "string", maxLength: feedbackMax },
          is_doodle: { type: "boolean" },
          recognition_confidence: { type: "number", minimum: 0, maximum: 1 },
          stroke_estimate: { type: "integer", minimum: 0 }
        },
        required: ["recognized", "definition", "target_match", "score", "feedback"]
      }
    }
  });

  const finishReason = gc?.candidates?.[0]?.finishReason || null;

  let textOut = typeof gc?.text === "string" ? gc.text : "";
  if (!textOut) {
    const cand = gc?.candidates?.[0];
    const part = cand?.content?.parts?.find(p => typeof p?.text === "string");
    if (part?.text) textOut = part.text;
  }

  return { textOut, finishReason, promptFeedback: gc?.promptFeedback || null };
}

// ---------------- Route ----------------
app.post("/api/eval-handwriting", async (req, res) => {
  try {
    const { image, target } = req.body || {};
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return res.status(400).json({ error: "bad_request", detail: "Expected a data URL image in 'image'." });
    }
    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "server_config", detail: "Missing GOOGLE_API_KEY (or GEMINI_API_KEY)." });
    }

    const m = image.match(/^data:(.+?);base64,(.*)$/);
    if (!m) return res.status(400).json({ error: "bad_request", detail: "Invalid data URL format." });
    const mimeType = m[1];
    const base64   = m[2];

    // Attempt 1
    let { textOut, finishReason, promptFeedback } = await callModel({
      base64, mimeType, target,
      maxTokens: DEFAULT_MAX_TOKENS,
      feedbackMax: FEEDBACK_MAX
    });

    let parsed = tryParseJSON(textOut);

    const needRetry =
      finishReason === "MAX_TOKENS" ||
      !textOut || !textOut.trim() ||
      !parsed || !parsed.feedback;

    if (needRetry) {
      // Attempt 2 (larger cap, tighter feedback)
      const again = await callModel({
        base64, mimeType, target,
        maxTokens: RETRY_MAX_TOKENS,
        feedbackMax: RETRY_FEEDBACK_MAX,
        extraInstruction: "If you cannot fit within limits, prioritize valid JSON. For mismatch, keep score ≤10 and feedback ultra-concise."
      });
      textOut        = again.textOut || textOut;
      finishReason   = again.finishReason || finishReason;
      promptFeedback = again.promptFeedback || promptFeedback;
      parsed         = tryParseJSON(textOut);
    }

    if (!textOut || !textOut.trim()) {
      return res.status(502).json({
        error: "model_no_content",
        detail:
          finishReason === "MAX_TOKENS"
            ? "The model hit its maximum output tokens twice."
            : "The model returned no text.",
        finishReason,
        promptFeedback
      });
    }

    const finalScore = computeFinalScore(parsed, target);

    const out = {
      score: finalScore, // decimals preserved
      recognized: parsed?.recognized ?? undefined,
      definition: parsed?.definition ?? undefined,
      feedback:
        parsed?.feedback ??
        parsed?.reason ??
        (textOut ? String(textOut).slice(0, 400) : undefined),
      target_match:
        parsed?.target_match === true ||
        (parsed?.recognized || "").trim() === (target || "").trim(),
      mismatch_reason: parsed?.mismatch_reason || undefined,
      is_doodle: parsed?.is_doodle === true || looksLikeDoodle(parsed?.recognized),
      recognition_confidence: Number(parsed?.recognition_confidence ?? NaN),
      stroke_estimate: Number.isFinite(Number(parsed?.stroke_estimate))
        ? Number(parsed.stroke_estimate)
        : undefined,
      raw: textOut,
      model: MODEL,
      finishReason: finishReason || undefined
    };

    if (!out.feedback) {
      return res.status(502).json({ error: "bad_json", detail: "Missing 'feedback'.", raw: textOut, finishReason });
    }

    return res.json(out);
  } catch (e) {
    if (e?.status === 429 || e?.error?.status === "RESOURCE_EXHAUSTED") {
      return res.status(429).json({
        error: "quota_exceeded",
        detail: "Rate or daily quota exceeded. Try later or switch model/tier."
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
