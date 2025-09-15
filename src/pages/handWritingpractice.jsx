import React, { useEffect, useRef, useState } from 'react'

export default function HandwritePractice() {
  const [target, setTarget] = useState('木')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const c = canvasRef.current
    c.width = 384; c.height = 384
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.lineWidth = 16; ctx.strokeStyle = '#000'
    ctxRef.current = ctx
  }, [])

  const getPos = (e) => {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    const p = ('touches' in e) ? e.touches[0] : e
    return {
      x: (p.clientX - r.left) * (c.width / r.width),
      y: (p.clientY - r.top) * (c.height / r.height),
    }
  }
  const down = (e) => { e.preventDefault(); drawing.current = true; last.current = getPos(e) }
  const move = (e) => {
    if (!drawing.current) return
    const p = getPos(e)
    const ctx = ctxRef.current
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p
  }
  const up = () => { drawing.current = false }

  const clearCanvas = () => {
    const c = canvasRef.current, ctx = ctxRef.current
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height)
    setResult(null); setError(null)
  }

  const exportPNG = () => {
    // simple export (no cropping) so we can verify quickly
    return canvasRef.current.toDataURL('image/png')
  }

    const evaluate = async () => {
    try {
        setLoading(true); setError(null); setResult(null);
        const dataUrl = exportPNG();

        const res = await fetch('/api/eval-handwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, target }),
        });

        const text = await res.text();                // get raw text
        console.log('[eval] status', res.status, 'body', text.slice(0, 400));

        // Try to parse JSON; if it fails, still show the raw text
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { /* ignore */ }

        setResult({ parsed, raw: text });             // store both
        if (!res.ok) throw new Error(text);
    } catch (e) {
        setError(String(e));
    } finally {
        setLoading(false);
    }
    };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Handwriting Practice</h1>
      <label style={{ display: 'block', marginBottom: 12 }}>
        Target:&nbsp;
        <input value={target} onChange={e=>setTarget(e.target.value)} style={{ fontSize: 18, width: 120 }} />
      </label>

      <canvas
        ref={canvasRef}
        style={{ border: '2px solid #333', borderRadius: 8, touchAction: 'none', display: 'block' }}
        onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
        onTouchStart={down} onTouchMove={move} onTouchEnd={up}
      />

      <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <button onClick={clearCanvas} style={{ padding: '10px 16px', fontSize: 18 }}>Clear</button>
        <button onClick={evaluate} disabled={loading}
                style={{ padding: '12px 20px', fontSize: 20, fontWeight: 700, background: '#2563eb', color: '#fff', borderRadius: 8 }}>
          {loading ? 'Evaluating…' : 'Evaluate'}
        </button>
      </div>

        <div style={{ marginTop: 16 }}>
        {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}

        {result && (
            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            {(() => {
                const parsed = result.parsed ?? result; // supports either shape
                const hasScore = Number.isFinite(parsed?.score);
                return hasScore ? (
                <>
                    <div><b>Score:</b> {parsed.score}/100</div>
                    <div><b>Recognized:</b> {parsed.recognized ?? '—'}</div>
                    <div><b>Feedback:</b> {parsed.feedback ?? '—'}</div>
                </>
                ) : (
                <>
                    <div style={{ marginBottom: 6 }}>Couldn’t parse JSON — showing raw response:</div>
                </>
                );
            })()}

            {/* Always show raw output for debugging */}
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto' }}>
                {typeof result === 'string'
                ? result
                : result.raw ?? JSON.stringify(result, null, 2)}
            </pre>
            </div>
        )}
        </div>

    </div>
  )
}