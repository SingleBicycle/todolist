// server.js (Node v18+ with global fetch)

import express from 'express'
import cors from 'cors'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/eval-handwriting', async (req, res) => {
  try {
    const { image, target } = req.body || {}
    if (!image || !image.startsWith('data:image')) {
      return res.status(400).json({ error: 'Missing data URL image' })
    }

    // Stronger system prompt to bias strict JSON
    const system = [
      'You are a strict Chinese handwriting grader.',
      'Assess similarity to the target Han character (strokes, structure, proportions).',
      'Reply ONLY as a JSON object: {"score":0-100,"recognized":"…","feedback":"…"}',
      'No extra text, no code fences.'
    ].join(' ')

    const userText = `Target: ${target || '(none)'}.
Score how well the handwritten image matches the target.
If the target is empty, identify the character and give 2–3 improvement tips.`

    // ---- OLLAMA (local, no key) ----
    const b64 = image.startsWith('data:') ? image.split(',')[1] : image

    // Optional: timeout so requests don’t hang forever
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120000) // 120s

    let resp
    try {
      resp = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'llava:7b',
          stream: false,
          format: 'json', // ask llama.cpp to return JSON
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userText, images: [b64] },
          ],
        }),
        signal: controller.signal,
      })
    } catch (e) {
      clearTimeout(timer)
      // Connection or timeout error
      return res.status(502).json({
        error: 'VLM upstream error',
        detail: String(e?.message || e),
      })
    }
    clearTimeout(timer)

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return res.status(502).json({
        error: 'VLM upstream error',
        detail: text || '(empty upstream body)',
      })
    }

    // Ollama chat returns { message: { content } }
    const data = await resp.json()
    let content = (data?.message?.content ?? '').trim()

    // If model returned nothing, keep the whole response as text so the UI shows something
    if (!content) content = JSON.stringify(data)

    // Try strict JSON -> loose JSON -> fall back to raw string
    let parsed = null
    try {
      parsed = JSON.parse(content)
    } catch {
      const m = typeof content === 'string' ? content.match(/\{[\s\S]*\}/) : null
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch {}
      }
    }

    const rawStr = typeof content === 'string' ? content : JSON.stringify(content)

    const out = {
      score: Number.isFinite(parsed?.score) ? parsed.score : undefined,
      recognized: parsed?.recognized ?? parsed?.char ?? parsed?.text ?? undefined,
      feedback: parsed?.feedback
        ?? parsed?.reason
        ?? (rawStr ? rawStr.slice(0, 400) : 'No feedback text.'),
      raw: rawStr, // always a STRING so your UI <pre> shows it
    }

    return res.json(out)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'server_error', detail: String(e) })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`))
