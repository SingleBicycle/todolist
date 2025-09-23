import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const WIDTH = 600;
const HEIGHT = 650;

const PlayPage = () => {
  const [target, setTarget] = useState("木");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const c = canvasRef.current;
    c.width = WIDTH;   // internal pixel width
    c.height = HEIGHT; // internal pixel height
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#111827";
    ctxRef.current = ctx;
  }, []);

  const getPos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const p = "touches" in e ? e.touches[0] : e;
    return {
      x: (p.clientX - r.left) * (c.width / r.width),
      y: (p.clientY - r.top) * (c.height / r.height),
    };
  };

  const down = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = getPos(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    const p = getPos(e);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const up = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setResult(null);
    setError(null);
  };

   const evaluate = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const dataUrl = canvasRef.current.toDataURL("image/png");

      const res = await fetch("/api/eval-handwriting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, target }),
      });

      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* ignore */
      }

      setResult({ parsed, raw: text });
      setShowModal(true); // open modal
      if (!res.ok) throw new Error(text);
    } catch (e) {
      setError(String(e));
      setShowModal(true); // also open modal for errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container px-6 m-auto pt-10  max-w-[600px] max-h-[650px]">
      <div>
      <p>Lets try the character: {target}</p>
      </div>

      <canvas

        ref={canvasRef}
        style={{ touchAction: "none" }}
        className={`rounded-md border-2 border-gray-300 
         w-full h-auto
          ${loading ? "!cursor-not-allowed pointer-events-none opacity-50" : ""}`}
        onMouseDown={down}
        onMouseMove={move}
        onMouseUp={up}
        onMouseLeave={up}
        onTouchStart={down}
        onTouchMove={move}
        onTouchEnd={up}
      />
      <div className="flex justify-between pt-3">
      <button
  disabled={loading}
  onClick={clearCanvas}
  className={`bg-[var(--primary)] text-white !px-6 !py-2 !rounded-md
              ${loading ? "!cursor-not-allowed opacity-50" : ""}`}
>
  Clear
</button>

<button
  disabled={loading}
  onClick={evaluate}
  className={`bg-[var(--primary)] text-white !px-8 !rounded-md
              ${loading ? "!cursor-not-allowed opacity-50" : ""}`}
>
  {loading ? "Evaluating…" : "Evaluate"}
</button>
      </div>
      
      
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5 cursor-pointer" />
            </button>

            {error ? (
              <div className="text-red-600">
                <b>Error:</b> {error}
              </div>
            ) : result?.parsed ? (
              <>
                <h2 className="text-lg font-bold mb-2">Result</h2>
                <p>
                  <b>Score:</b> {result.parsed.score}/100
                </p>
                <p>
                  <b>Recognized:</b> {result.parsed.recognized ?? "—"}
                </p>
                <p>
                  <b>Feedback:</b> {result.parsed.feedback ?? "—"}
                </p>
              </>
            ) : (
              <div>
                Could not parse JSON. <br />
                Raw response:
                <pre className="mt-2 p-2 bg-gray-100 rounded text-sm max-h-40 overflow-auto">
                  {result?.raw ?? "—"}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayPage;
