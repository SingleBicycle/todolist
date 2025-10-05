// server.js
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

// First pass cap (JSON is small but be generous)
const DEFAULT_MAX_TOKENS = Number(process.env.GEN_MAX_TOKENS) || 2048;
// Retry cap if first pass hits MAX_TOKENS / bad JSON
const RETRY_MAX_TOKENS   = Number(process.env.GEN_RETRY_TOKENS) || 8192;

// Keep feedback concise to avoid bloating output
const FEEDBACK_MAX       = Number(process.env.FEEDBACK_MAX_CHARS) || 220;
const RETRY_FEEDBACK_MAX = Math.min(FEEDBACK_MAX, 180); // tighter on retry

// Use beta endpoints so camelCase config is accepted by the backend.
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, model: MODEL, maxTokens: { first: DEFAULT_MAX_TOKENS, retry: RETRY_MAX_TOKENS } })
);

// ----- helper: one call with structured JSON + limits -----
async function generateGrade({ base64, mimeType, target, maxTokens, feedbackMax, extraInstruction = "" }) {
  const systemInstruction =
    `You are a strict Chinese handwriting grader. Assess similarity to the target Han character (strokes, structure, proportions).
Reply ONLY as a JSON object: {"score":0-100,"recognized":"…","feedback":"…"}.
No extra text, no code fences. Keep "feedback" ${feedbackMax} characters or less. ${extraInstruction}`.trim();

  const userPrompt =
    `Target: ${target || "(none)"}.
Score how well the handwritten image matches the target.
If the target is empty, identify the character and give 2–3 improvement tips (concise).`;

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
      temperature: 0.2,
      candidateCount: 1,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          score: { type: "integer", minimum: 0, maximum: 100 },
          recognized: { type: "string", maxLength: 10 },
          feedback: { type: "string", maxLength: feedbackMax },
        },
        required: ["feedback"],
      },
    },
  });

  const finishReason = gc?.candidates?.[0]?.finishReason || null;

  // Prefer convenience .text; fallback to first text part
  let textOut = typeof gc?.text === "string" ? gc.text : "";
  if (!textOut) {
    const cand = gc?.candidates?.[0];
    const part = cand?.content?.parts?.find((p) => typeof p?.text === "string");
    if (part?.text) textOut = part.text;
  }

  return { textOut, finishReason, promptFeedback: gc?.promptFeedback || null };
}

// ----- route -----
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
    if (!m) {
      return res.status(400).json({ error: "bad_request", detail: "Invalid data URL format." });
    }
    const mimeType = m[1];
    const base64 = m[2];

    // ----- attempt 1 -----
    let { textOut, finishReason, promptFeedback } = await generateGrade({
      base64, mimeType, target,
      maxTokens: DEFAULT_MAX_TOKENS,
      feedbackMax: FEEDBACK_MAX,
    });

    const tryParse = (s) => {
      if (!s) return null;
      try { return JSON.parse(s); } catch {
        const j = s.match(/\{[\s\S]*\}/);
        if (j) { try { return JSON.parse(j[0]); } catch {} }
        return null;
      }
    };
    let parsed = tryParse(textOut);

    const needRetry =
      finishReason === "MAX_TOKENS" ||
      !textOut || !textOut.trim() ||
      !parsed || !parsed.feedback;

    if (needRetry) {
      // ----- attempt 2 (more tokens, even tighter feedback) -----
      const again = await generateGrade({
        base64, mimeType, target,
        maxTokens: RETRY_MAX_TOKENS,
        feedbackMax: RETRY_FEEDBACK_MAX,
        extraInstruction:
          "If you cannot fit within the limit, prioritize returning a valid JSON object and keep 'feedback' extremely short.",
      });
      textOut        = again.textOut || textOut;
      finishReason   = again.finishReason || finishReason;
      promptFeedback = again.promptFeedback || promptFeedback;
      parsed         = tryParse(textOut);
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

    const out = {
      score: Number.isFinite(parsed?.score) ? parsed.score : undefined,
      recognized: parsed?.recognized ?? parsed?.char ?? parsed?.text ?? undefined,
      feedback:
        parsed?.feedback ??
        parsed?.reason ??
        (textOut ? String(textOut).slice(0, 400) : undefined),
      raw: textOut,
      model: MODEL,
      finishReason: finishReason || undefined,
    };

    if (!out.feedback) {
      return res.status(502).json({
        error: "bad_json",
        detail: "Model replied without required 'feedback'.",
        raw: textOut,
        finishReason,
      });
    }

    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server_error", detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
