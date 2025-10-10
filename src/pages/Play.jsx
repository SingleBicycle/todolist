import { useEffect, useRef, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { testtHanziWriter } from "../utils/hanzi";
import { getCurrentUser } from "./Login";
import {
  getCharacterById,
  getDifficultyCharacter,
  getUserById,
} from "../firebase/database";

const CWIDTH = 620;
const CHEIGHT = 620;
export { CWIDTH, CHEIGHT };

const DIFFICULTIES = {
  1: "Easy",
  2: "Okay",
  3: "Med",
  4: "Hard",
  5: "So hard",
};
const SORTED_DIFFICULTIES = Object.keys(DIFFICULTIES)
  .sort((a, b) => a - b)
  .map((key) => ({ key: Number(key), label: DIFFICULTIES[key] }));

const canvasHasInk = (canvas) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
};

const PlayPage = () => {
  const [target, setTarget] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [characters, setCharacters] = useState([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const canvasRef = useRef(null);
  const writerRef = useRef(null);
  const writerContainerRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);

  // Initialize user data and load first character (runs once on mount)
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const user = await getCurrentUser();
        let selectedDifficulty = 1;
        let selectedTarget = "";

        if (user?.uid) {
          // Authorized user
          const dbUser = await getUserById(user.uid);
          if (dbUser?.last_word) {
            const lastCharacter = await getCharacterById(dbUser.last_word);
            if (lastCharacter) {
              selectedDifficulty = lastCharacter.difficulty;
              selectedTarget = lastCharacter.content;
            }
          }
        }

        // Load characters for the selected difficulty
        let chars = await getDifficultyCharacter(selectedDifficulty);
        chars = chars.map((char) => char.content);
        if (chars && chars.length > 0) {
          setCharacters(chars);
          setDifficulty(selectedDifficulty);
          setTarget(selectedTarget || chars[0]);
        } else {
          setError("No characters available for this difficulty");
          setShowModal(true);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError(String(err));
        setShowModal(true);
      } finally {
        setLoading(false);
        initialized.current = true;
      }
    };

    init();
  }, []);

  // Initialize canvas context (runs once)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || ctxRef.current) return;

    c.width = CWIDTH;
    c.height = CHEIGHT;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#111827";
    ctxRef.current = ctx;
  }, []);

  // Update HanziWriter when target changes
  useEffect(() => {
    if (!writerContainerRef.current || !target) return;

    // Clean up existing writer
    if (writerRef.current) {
      writerContainerRef.current.innerHTML = "";
      writerRef.current = null;
    }

    // Create new writer
    writerRef.current = testtHanziWriter(writerContainerRef.current, target);

    return () => {
      if (writerContainerRef.current) {
        writerContainerRef.current.innerHTML = "";
      }
      writerRef.current = null;
    };
  }, [target]);

  // Load characters when difficulty changes (skip on initial mount)
  useEffect(() => {
    if (!initialized.current) return;

    const loadChars = async () => {
      try {
        let chars = await getDifficultyCharacter(difficulty);
        if (chars && chars.length > 0) {
          chars = chars.map((char) => char.content);
          setCharacters(chars);
          // If current target is not in new difficulty, switch to first character
          if (!chars.includes(target)) {
            setTarget(chars[0]);
          }
        }
      } catch (err) {
        console.error("Error loading characters:", err);
        setError(String(err));
        setShowModal(true);
      }
    };

    loadChars();
  }, [difficulty]);

  const [showGrid, setShowGrid] = useState(false);
  const gridRef = useRef(null);

  // Add useEffect for outside click detection
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gridRef.current && !gridRef.current.contains(event.target)) {
        setShowGrid(false);
      }
    };

    if (showGrid) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showGrid]);

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
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const up = () => {
    drawing.current = false;
  };

  const clearDrawing = () => {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
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

      if (!canvasHasInk(canvasRef.current)) {
        setError("Please draw something before evaluating 🙂");
        setShowModal(true);
        return;
      }

      const dataUrl = canvasRef.current.toDataURL("image/png");
      console.log(dataUrl);
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

      setResult({ parsed, raw: text });
      setShowModal(true);
    } catch (e) {
      setError(String(e));
      setShowModal(true);
    } finally {
      clearDrawing();
      setLoading(false);
    }
  };

  const handleCharacterChange = (char) => {
    setTarget(char);
    clearDrawing();
    setShowGrid(false);
  };

  const handleDifficultyChange = (e) => {
    const selectedLabel = e.target.value;
    const difficultyEntry = SORTED_DIFFICULTIES.find(
      (d) => d.label === selectedLabel
    );
    if (difficultyEntry) {
      setDifficulty(difficultyEntry.key);
      clearDrawing();
    }
  };

  return (
    <div className="bg-[var(--tertiary)] w-full h-screen">
      <div className="container m-auto pt-10 max-w-[620px]">
        <div className="flex justify-between pb-1">
          <div className="text-lg flex gap-2 items-center text-[var(--text)]">
            Let's try a/an{" "}
            <select
              value={DIFFICULTIES[difficulty]}
              onChange={handleDifficultyChange}
              disabled={loading}
              className={`pl-2 !pr-0 py-1 rounded-md border-1 border-gray-300 bg-white ${
                loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              {SORTED_DIFFICULTIES.map((item) => (
                <option key={item.key} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>{" "}
            character:
            <div className="relative">
              <button
                onClick={() => setShowGrid(!showGrid)}
                disabled={loading}
                className={`!px-2 !py-0 border !rounded-md border-gray-300 bg-white ${
                  loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
              >
                {target || ""}
              </button>

              {showGrid && (
                <div
                  ref={gridRef}
                  className="absolute top-full left-0 mt-1 p-2 bg-white rounded-md border border-gray-300 shadow-lg z-10"
                >
                  <div className="grid grid-cols-6 gap-2 w-md">
                    {characters.map((char, index) => (
                      <button
                        key={index}
                        onClick={() => handleCharacterChange(char)}
                        disabled={loading}
                        className={`!p-0 text-xl font-bold rounded-sm border-1 transition-all ${
                          target === char
                            ? "border-blue-600 bg-blue-50 text-blue-600"
                            : "border-gray-300 bg-white text-gray-800 hover:border-blue-400 hover:bg-blue-50"
                        } ${
                          loading
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            !
          </div>
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

        <div className="relative min-h-[620px] bg-white rounded-md border-gray-300 border-dashed border-4">
          {/* HanziWriter container - separate from canvas */}
          <div
            ref={writerContainerRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />

          {/* Canvas for drawing */}
          <canvas
            width={CWIDTH}
            height={CHEIGHT}
            ref={canvasRef}
            style={{ touchAction: "none" }}
            className={`rounded-md m-auto !p-0 absolute top-0 !bg-transparent cursor-crosshair ${
              loading
                ? "!cursor-not-allowed pointer-events-none opacity-50"
                : ""
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
              onClick={resetAll}
              className={`bg-[var(--primary)] text-white !px-6 !py-2 !rounded-md ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              Clear
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
                className="absolute top-2 right-0 text-gray-500 hover:text-gray-700"
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
