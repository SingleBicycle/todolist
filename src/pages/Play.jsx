import { useEffect, useRef, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { testtHanziWriter } from "../utils/hanzi";

const CWIDTH = 620;
const CHEIGHT = 620;
export { CWIDTH, CHEIGHT };

const CHARACTERS = [
  { char: "木", label: "木 (tree)" },
  { char: "水", label: "水 (water)" },
  { char: "火", label: "火 (fire)" },
  { char: "土", label: "土 (earth)" },
  { char: "日", label: "日 (sun)" },
  { char: "月", label: "月 (moon)" },
  { char: "人", label: "人 (person)" },
  { char: "大", label: "大 (big)" },
  { char: "小", label: "小 (small)" },
];

const canvasHasInk = (canvas) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true; // any non-transparent pixel
  }
  return false;
};

const PlayPage = () => {
  const [target, setTarget] = useState("木");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { parsed, raw }
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const canvasRef = useRef(null);
  const writerRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    c.width = CWIDTH;
    c.height = CHEIGHT;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#111827";
    ctxRef.current = ctx;

    if (!writerRef.current && containerRef.current) {
      writerRef.current = testtHanziWriter(containerRef.current, target);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      ctxRef.current = null;
    };
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

  // Only clear the drawing, not the result/error
  const clearDrawing = () => {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const resetAll = () => {
    clearDrawing();
    setResult(null);
    setError(null);
  };

  const animate = () => {
    if (!writerRef.current) return;
    writerRef.current.hideCharacter();
    writerRef.current.animateCharacter({
      onComplete: () => writerRef.current.hideCharacter(),
    });
  };

  const evaluate = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // guard: don't send empty canvas
      if (!canvasHasInk(canvasRef.current)) {
        setError("Please draw something before evaluating 🙂");
        setShowModal(true);
        return;
      }

      const dataUrl = canvasRef.current.toDataURL("image/png");

      const res = await fetch("/api/eval-handwriting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, target }),
      });

      // Prefer JSON; if server sent error JSON (e.g., 502), show it in modal
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave parsed as null
      }

      if (!res.ok) {
        const msg =
          (parsed && (parsed.detail || parsed.error || parsed.raw)) ||
          text ||
          "Request failed";
        setError(String(msg));
        setShowModal(true);
        return;
      }

      // Success path: server already returns JSON with score/recognized/feedback/raw
      setResult({ parsed, raw: text });
      setShowModal(true);
    } catch (e) {
      setError(String(e));
      setShowModal(true);
    } finally {
      clearDrawing(); // keep result/error visible in modal
      setLoading(false);
    }
  };

  const handleCharacterChange = (e) => {
    const newTarget = e.target.value;
    setTarget(newTarget);
    clearDrawing();
    if (writerRef.current) {
      writerRef.current.setCharacter(newTarget);
    }
  };

  const handleDifficultyChange = (_e) => {};

  return (
    <div className="bg-[var(--tertiary)] w-full h-screen ">
      <div className="container m-auto pt-10 max-w-[620px] max-h-[620px]">
        <div className="flex justify-between pb-1">
          <p className="text-lg">
            Let’s try a/an{" "}
            <select
              value={"Easy"}
              onChange={handleDifficultyChange}
              disabled={loading}
              className={`pl-2 !pr-0 py-1 rounded-md border-1 border-gray-300 bg-white ${
                loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              {["Easy", "Med", "Hard"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>{" "}
            character:
            <select
              value={target}
              onChange={handleCharacterChange}
              disabled={loading}
              className={`pl-2 pr-0 py-1 rounded-md border-1 border-gray-300 bg-white ${
                loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              {CHARACTERS.map((item) => (
                <option key={item.char} value={item.char}>
                  {item.label}
                </option>
              ))}
            </select>
            !
          </p>
          <button
            disabled={loading}
            onClick={animate}
            className={`bg-[var(--primary)] flex gap-2 text-white !px-3 !py-2 !rounded-md ${
              loading ? "!cursor-not-allowed opacity-50" : ""
            }`}
          >
            <PlayCircle /> Animate
          </button>
        </div>

        <div ref={containerRef} className="relative bg-white">
          <canvas
            width={CWIDTH}
            height={CHEIGHT}
            ref={canvasRef}
            style={{ touchAction: "none" }}
            className={`rounded-md m-auto !p-0 border-gray-300 border-dashed border-4 absolute top-0 !bg-transparent ${
              loading ? "!cursor-not-allowed pointer-events-none opacity-50" : ""
            }`}
            onMouseDown={down}
            onMouseMove={move}
            onMouseUp={up}
            onMouseLeave={up}
            onTouchStart={down}
            onTouchMove={move}
            onTouchEnd={up}
          />
        </div>

        <div className="flex justify-between pt-3">
          <div className="flex gap-2">
            <button
              disabled={loading}
              onClick={clearDrawing}
              className={`bg-[var(--primary)] text-white !px-6 !py-2 !rounded-md ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              Clear
            </button>
            <button
              disabled={loading}
              onClick={resetAll}
              className={`bg-gray-500 text-white !px-6 !py-2 !rounded-md ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              Reset
            </button>
          </div>

          <button
            disabled={loading}
            onClick={evaluate}
            className={`bg-[var(--primary)] text-white !px-8 !rounded-md ${
              loading ? "!cursor-not-allowed opacity-50" : ""
            }`}
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
                    <b>Score:</b>{" "}
                    {Number.isFinite(result.parsed.score)
                      ? `${result.parsed.score}/100`
                      : "—"}
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
                    {typeof result?.raw === "string" && result.raw.length
                      ? result.raw
                      : "—"}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayPage;