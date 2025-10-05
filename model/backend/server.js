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

// First pass / retry caps
const DEFAULT_MAX_TOKENS = Number(process.env.GEN_MAX_TOKENS) || 2048;
const RETRY_MAX_TOKENS   = Number(process.env.GEN_RETRY_TOKENS) || 8192;

// Keep feedback concise
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

// ---- helpers ----
function tryParseJSON(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch {
    const j = s.match(/\{[\s\S]*\}/);
    if (j) { try { return JSON.parse(j[0]); } catch {} }
    return null;
  }
}

function computeFinalScore(parsed, target) {
  // Robust guards
  const targetChar = (target || "").trim();
  const rec = (parsed?.recognized || "").trim();

  // If model supplies boolean, use it; else derive from literal equality.
  const modelMatch = parsed?.target_match === true;
  const literalMatch = targetChar && rec && rec === targetChar;
  const match = modelMatch || literalMatch;

  // Start from model score, clamp to [0,100]
  let score = Number.isFinite(parsed?.score) ? parsed.score : 0;
  score = Math.max(0, Math.min(100, score));

  // HARD RULE: if mismatch, cap final score to <= 20
  if (targetChar && !match) {
    score = Math.min(score, 20);
  }
  return score;
}

async function callModel({ base64, mimeType, target, maxTokens, feedbackMax, extraInstruction = "" }) {
  // Two-step rubric inside one response:
  // (1) Recognize the drawn hanzi (top1). (2) Compare ONLY to target; if mismatch => cap score <=20 and explain mismatch.
  const systemInstruction =
`TASK:
1) Recognize the single Chinese character in the user's image (top-1).
2) Compare ONLY to the given target character.
SCORING POLICY:
- If recognized != target (including common simplified/traditional mismatch), set target_match=false AND set score <= 20 (0–20).
- If recognized == target (or canonical simple/trad equivalent), set target_match=true and grade quality by structure (0–60), strokes (0–20), proportions (0–20). Sum = score (0–100).
- Keep "feedback" <= ${feedbackMax} chars, concise and actionable.
- Reply ONLY JSON. No prose.

NOTES:
- Do NOT grade in isolation; ALWAYS judge similarity to target.
- If mismatch, briefly say what's recognized and why it differs (mismatch_reason).
${extraInstruction}`.trim();

  const userPrompt =
`Target: ${target || "(none)"}.
Return strict JSON with:
{
  "recognized": "<top1>",
  "target_match": true|false,
  "mismatch_reason": "<why>",        // required if target_match=false
  "subscores": { "structure": 0-60, "strokes": 0-20, "proportion": 0-20 },
  "score": 0-100,                    // if mismatch, must be <=20
  "feedback": "<<=${feedbackMax} chars>"
}`;

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
          recognized: { type: "string", maxLength: 10 },
          target_match: { type: "boolean" },
          mismatch_reason: { type: "string", maxLength: 80 },
          subscores: {
            type: "object",
            additionalProperties: false,
            properties: {
              structure: { type: "integer", minimum: 0, maximum: 60 },
              strokes:   { type: "integer", minimum: 0, maximum: 20 },
              proportion:{ type: "integer", minimum: 0, maximum: 20 }
            }
          },
          score: { type: "integer", minimum: 0, maximum: 100 },
          feedback: { type: "string", maxLength: feedbackMax }
        },
        required: ["recognized", "target_match", "score", "feedback"]
      }
    }
  });

  const finishReason = gc?.candidates?.[0]?.finishReason || null;

  // Prefer convenience .text; fallback to first text part
  let textOut = typeof gc?.text === "string" ? gc.text : "";
  if (!textOut) {
    const cand = gc?.candidates?.[0];
    const part = cand?.content?.parts?.find(p => typeof p?.text === "string");
    if (part?.text) textOut = part.text;
  }

  return { textOut, finishReason, promptFeedback: gc?.promptFeedback || null };
}

// ---- route ----
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
      // Attempt 2 (bigger cap, tighter feedback)
      const again = await callModel({
        base64, mimeType, target,
        maxTokens: RETRY_MAX_TOKENS,
        feedbackMax: RETRY_FEEDBACK_MAX,
        extraInstruction: "If you cannot fit within limits, prioritize valid JSON. For mismatch, keep score <=20 and feedback ultra-concise."
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

    // Enforce target-aware policy in code (final guard)
    const finalScore = computeFinalScore(parsed, target);

    // Build response for your UI
    const out = {
      score: finalScore,
      recognized: parsed?.recognized ?? undefined,
      feedback:
        parsed?.feedback ??
        parsed?.reason ??
        (textOut ? String(textOut).slice(0, 400) : undefined),
      // You can show this in UI if you want:
      target_match: parsed?.target_match === true || (parsed?.recognized || "").trim() === (target || "").trim(),
      mismatch_reason: parsed?.mismatch_reason || undefined,
      raw: textOut,
      model: MODEL,
      finishReason: finishReason || undefined
    };

    if (!out.feedback) {
      return res.status(502).json({ error: "bad_json", detail: "Missing 'feedback'.", raw: textOut, finishReason });
    }

    return res.json(out);
  } catch (e) {
    // Distinguish quota vs other errors (optional)
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
