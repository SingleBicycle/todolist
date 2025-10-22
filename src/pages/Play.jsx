import { useEffect, useRef, useState } from "react";
import { testtHanziWriter } from "../utils/hanzi";
import { getCurrentUser } from "./Login";
import {
  getCharacterById,
  getDifficultyCharacter,
  getUserById,
  updateUser,
} from "../firebase/database";
import { PlayCircle, X } from "lucide-react";
import BackButton from "./BackButton"

const CWIDTH = 620;
const CHEIGHT = 620;
export { CWIDTH, CHEIGHT };

const POINTS_PER_WORD_PER_DIFFICULTY = 30;
const SCORE_THRES = 70;
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

const PlayPage = ({ updateNavScore }) => {
  const [charData, setCharData] = useState({
    id: "",
    content: "",
    difficulty: 1,
    characters: {},
  });

  const dbUserRef = useRef({});

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

  // Initialize user data and load first character (init only ran once)
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const user = await getCurrentUser();
        let selectedDifficulty = 1;
        let selectedTarget = "";
        let selectedTargetId = "";

        if (user?.uid) {
          // Authorized user
          const dbUser = await getUserById(user.uid);
          dbUserRef.current = dbUser;

          if (dbUser?.last_word) {
            const lastCharacter = await getCharacterById(dbUser.last_word);

            if (lastCharacter) {
              selectedDifficulty = lastCharacter.difficulty;
              selectedTarget = lastCharacter.content;
              selectedTargetId = dbUser.last_word;
            }
          }
        }

        // Load characters for the selected difficulty
        const chars = await getDifficultyCharacter(selectedDifficulty);
        if (chars && chars.length > 0) {
          setCharData((prev) => ({
            ...prev,
            id: selectedTargetId,
            content: selectedTarget,
            difficulty: selectedDifficulty,
            characters: chars.reduce((acc, char) => {
              acc[char.id] = char.content;
              return acc;
            }, {}),
          }));

          console.log("set char");
        } else {
          setError("No characters available for this difficulty");
          setShowModal(true);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError(String(err));
        setShowModal(true);
      } finally {
        initialized.current = true;
        setLoading(false);
      }
    };

    if (!initialized.current) {
      init();
    }
  }, []);

  // Initialize canvas context (runs once)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || ctxRef.current || initialized.current) return;

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
    if (!writerContainerRef.current || !charData.content) return;

    writerRef.current = testtHanziWriter(
      writerContainerRef.current,
      charData.content
    );
  }, [charData.content]);

  const [showGrid, setShowGrid] = useState(false);
  const gridRef = useRef(null);

  // Add useEffect for outside click detection
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gridRef.current && !gridRef.current.contains(event.target)) {
        setShowGrid(false);
      }
    };
    let ignoreOnce = false;
    const guard = (e) => {
      if (ignoreOnce) {
        ignoreOnce = false;
        return;
      }
      handleClickOutside(e);
    };
    if (showGrid) {
      document.addEventListener("mousedown", guard);
    }

    return () => {
      document.removeEventListener("mousedown", guard);
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
  const updatePoints = async () => {
    if (
      dbUserRef.current?.id &&
      Array.isArray(dbUserRef.current.completed_words)
    ) {
      if (!dbUserRef.current.completed_words.includes(charData.id)) {
        await updateUser(dbUserRef.current.id, {
          points:
            (dbUserRef.current.points || 0) +
            charData.difficulty * POINTS_PER_WORD_PER_DIFFICULTY,
          completed_words: [...dbUserRef.current.completed_words, charData.id],
          last_word: charData.id,
        });
        updateNavScore(
          (dbUserRef.current.points || 0) +
            charData.difficulty * POINTS_PER_WORD_PER_DIFFICULTY
        );

        dbUserRef.current = await getUserById(dbUserRef.current.id);
      }
    }
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
      const res = await fetch("/api/eval-handwriting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, target: charData.content }),
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

      if (parsed.score >= SCORE_THRES) {
        updatePoints();
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
  const handleNextCharacter = async () => {
    setLoading(true);
    setShowModal(false);

    try {
      const completed = dbUserRef.current?.completed_words ?? [];
      const chars = await getDifficultyCharacter(charData.difficulty);
      const ids = chars.map((c) => c.id);
      const currentIdx = ids.indexOf(charData.id);

      let nextId = null;
      for (let i = 1; i <= ids.length; i++) {
        const idx = (currentIdx + i) % ids.length;
        if (!completed.includes(ids[idx])) {
          nextId = ids[idx];
          break;
        }
      }

      if (nextId) {
        handleCharacterChange(nextId);
        setLoading(false);
        return;
      }

      const all = [];
      for (const { key } of SORTED_DIFFICULTIES) {
        const diffChars = await getDifficultyCharacter(key);
        diffChars.forEach((c) => all.push({ ...c, difficulty: key }));
      }

      const currentGlobalIndex = all.findIndex((c) => c.id === charData.id);

      let nextGlobalIndex = -1;
      for (let i = 1; i <= all.length; i++) {
        const idx = (currentGlobalIndex + i) % all.length;
        if (!completed.includes(all[idx].id)) {
          nextGlobalIndex = idx;
          break;
        }
      }

      const target = nextGlobalIndex === -1 ? all[0] : all[nextGlobalIndex];

      if (target.difficulty !== charData.difficulty) {
        await handleDifficultyChange(DIFFICULTIES[target.difficulty]);
      } else {
        handleCharacterChange(target.id);
      }
    } catch (err) {
      console.error("Next-character error:", err);
      setError(String(err));
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterChange = (charId) => {
    setCharData((prev) => ({
      ...prev,
      id: charId,
      content: prev.characters[charId],
    }));
    clearDrawing();
    setShowGrid(false);
  };

  const handleDifficultyChange = async (newLevel) => {
    setLoading(true);
    const difficultyEntry = SORTED_DIFFICULTIES.find(
      (d) => d.label === newLevel
    );
    if (difficultyEntry.key != charData.difficulty) {
      try {
        const chars = await getDifficultyCharacter(difficultyEntry.key);

        if (chars && chars.length > 0) {
          setCharData((prev) => ({
            ...prev,
            id: chars[0].id,
            content: chars[0].content,
            difficulty: difficultyEntry.key,
            characters: chars.reduce((acc, char) => {
              acc[char.id] = char.content;
              return acc;
            }, {}),
          }));
        }
      } catch (err) {
        console.error("Error loading characters:", err);
        setError(String(err));
        setShowModal(true);
      }

      resetAll();
    }
    setLoading(false);
  };

  return (
    <div className="bg-[var(--tertiary)] w-full h-screen">
      <div className="container m-auto pt-10 max-w-[620px]">
        <div className="flex justify-between pb-1">
          <div className="text-lg flex gap-2 items-center text-[var(--text)]">
            Let's try a/an{" "}
            <select
              value={DIFFICULTIES[charData.difficulty]}
              onChange={(e) => {
                handleDifficultyChange(e.target.value);
              }}
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
                {charData.content || ""}
              </button>

              {showGrid && (
                <div
                  ref={gridRef}
                  className="absolute top-full left-0 mt-1 p-2 bg-white rounded-md border border-gray-300 shadow-lg z-10"
                >
                  <div className="grid grid-cols-6 gap-2 w-md">
                    {Object.entries(charData.characters).map(
                      ([id, content], index) => (
                        <button
                          key={index}
                          onClick={() => handleCharacterChange(id)}
                          disabled={loading}
                          className={`relative !p-0 text-xl font-bold rounded-sm border-1 transition-all ${
                            charData.id === id
                              ? "border-blue-600 bg-blue-50 text-blue-600"
                              : "border-gray-300 bg-white text-gray-800 hover:border-blue-400 hover:bg-blue-50"
                          } ${
                            loading
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer"
                          }`}
                        >
                          {content}
                          {/* ✅ Tiny checkmark badge */}
                          {dbUserRef.current?.completed_words.includes(id) && (
                            <span className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 bg-green-500 text-white text-[10px] rounded-full w-3 h-3 flex items-center justify-center shadow">
                              ✓
                            </span>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
            !
          </div>
          <button
            disabled={loading}
            onClick={animate}
            className={`bg-[var(--primary)] flex gap-2 text-white !px-3 !py-2 !rounded-md blue-button ${
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
              className={`bg-[var(--primary)] text-white !px-6 !py-2 !rounded-md blue-button ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              Clear
            </button>
          </div>

          <button
            disabled={loading}
            onClick={evaluate}
            className={`bg-[var(--primary)] text-white !px-8 !rounded-md blue-button ${
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
                className="absolute top-2 -right-3 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5 cursor-pointer" />
              </button>

              {error ? (
                <div className="text-red-600">
                  <b>Error:</b> {error}
                </div>
              ) : result?.parsed ? (
                <div
                  className="space-y-3
                "
                >
                  <div>
                    <h2 className="text-lg font-bold">Result:</h2>
                  </div>
                  <div>
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
                  </div>

                  <div className="w-full flex justify-between items-center gap-3">
                    <button
                      disabled={loading}
                      onClick={() => {
                        setShowModal(false);
                        resetAll();
                      }}
                      className={`bg-[var(--primary)] text-white !px-8 !rounded-md ${
                        loading ? "!cursor-not-allowed opacity-50" : ""
                      }`}
                    >
                      Try again
                    </button>
                    <button
                      disabled={loading}
                      onClick={handleNextCharacter}
                      className={`bg-[var(--primary)] text-white !px-8 !rounded-md ${
                        loading ? "!cursor-not-allowed opacity-50" : ""
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
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
        <div className="mt-8 mb-12">
          <BackButton />
        </div>
        
      </div>
    </div>
  );
};

export default PlayPage;
