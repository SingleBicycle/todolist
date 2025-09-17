// server.js


import express from 'express'
import cors from 'cors'

// If you run Node < 18, uncomment next line and `npm i node-fetch`
// import fetch from 'node-fetch'


import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' })) // allow base64 images

// Choose your model here.
const MODEL = process.env.VLM_MODEL || 'meta-llama/llama-3.2-90b-vision-instruct'

// Simple health
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/eval-handwriting', async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'server_config', detail: 'Missing OPENROUTER_API_KEY' })
    }

    const { image, target } = req.body || {}
    if (!image || !image.startsWith('data:image')) {
      return res.status(400).json({ error: 'Missing data URL image' })
    }

    // Build prompt that forces JSON response
    const system = [
      'You are a strict Chinese handwriting grader.',
      'Given a target Han character and an image of a handwritten character, assess visual similarity (strokes, structure, proportions).',
      'Return ONLY a JSON object with fields: score (0-100), recognized (string), feedback (short actionable tips).',
      'Do not include any extra text.'
    ].join(' ')
    const userText = `Target: ${target || '(none)'}.
Score how well the handwritten image matches the target.
If the target is empty, just identify the character and give improvement tips.`

    // OpenRouter (OpenAI-compatible chat completions with image)
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5173',
        'X-Title': process.env.APP_NAME || 'Kanji Master'
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ]
      })
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return res.status(502).json({ error: 'VLM upstream error', detail: text })
    }
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content?.trim() || '{}'

    let parsed
    try { parsed = JSON.parse(content) } catch {
      // Best-effort fallback: try to extract JSON substring
      const m = content.match(/\{[\s\S]*\}$/)
      parsed = m ? JSON.parse(m[0]) : {}
    }

    // Normalize fields
    const out = {
      score: typeof parsed.score === 'number' ? parsed.score : undefined,
      recognized: parsed.recognized ?? undefined,
      feedback: parsed.feedback ?? (typeof parsed.reason === 'string' ? parsed.reason : undefined),
      raw: parsed
    }
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'server_error', detail: String(e) })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`))
