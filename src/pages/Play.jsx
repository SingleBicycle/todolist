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

// Constants
const CWIDTH = 620;
const CHEIGHT = 620;
const POINTS_PER_WORD_PER_DIFFICULTY = 30;
const TEST_MODE_POINT_MULTIPLIER = 1.5;
const SCORE_THRESHOLD = 70;

const GAME_MODE = ["Standard", "Test"];

const DIFFICULTY_MAPPINGS = {
  Chinese: {
    1: "HSK 1",
    2: "HSK 2",
    3: "HSK 3",
    4: "HSK 4",
    5: "HSK 5",
    6: "HSK 6",
  },
  Japanese: {
    1: "JLPT N5",
    2: "JLPT N4",
    3: "JLPT N3",
    4: "JLPT N2",
    5: "JLPT N1",
  },
};

const getDifficultyLabels = (language) => {
  const difficulties =
    DIFFICULTY_MAPPINGS[language] || DIFFICULTY_MAPPINGS.Chinese;

  return {
    DIFFICULTIES: difficulties,
    SORTED_DIFFICULTIES: Object.keys(difficulties)
      .sort((a, b) => a - b)
      .map((key) => ({
        key: Number(key),
        label: difficulties[key],
      })),
  };
};

export { CWIDTH, CHEIGHT };

const canvasHasInk = (canvas) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
};

const getCanvasPos = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const point = "touches" in e ? e.touches[0] : e;
  return {
    x: (point.clientX - rect.left) * (canvas.width / rect.width),
    y: (point.clientY - rect.top) * (canvas.height / rect.height),
  };
};

const shuffleArray = (arr) => [...arr].sort(() => 0.5 - Math.random());

const getRandomChars = (charObj, count = 5) => {
  const shuffled = shuffleArray(Object.entries(charObj));
  return Object.fromEntries(shuffled.slice(0, count));
};

const calcFinalScore = (
  aiScore,
  confidence,
  strokeEstimate,
  targetMatch,
  orientationOk,
  strokeCount,
  isDoodle = false
) => {
  if (!orientationOk || !targetMatch || isDoodle) return 0;
  const strokeMatchRatio =
    (strokeEstimate - Math.abs(strokeEstimate - strokeCount)) / strokeEstimate;
  return aiScore * confidence * strokeMatchRatio;
};

// Main Component
const PlayPage = ({ updateNavScore }) => {
  // State
  const [charData, setCharData] = useState({
    id: "",
    content: "",
    difficulty: 1,
    characters: {},
  });
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TEST_MODE_TIME);

  const testModeRefs = useRef({
    scores: new Array(5).fill(0),
    images: new Array(5).fill(""),
    targets: new Array(5).fill(""),
    strokeCounts: new Array(5).fill(0),
    recognized: new Array(5).fill("-"),
    feedbacks: new Array(5).fill("No feedbacks"),
  });
  const refs = useRef({
    canvas: null,
    image: null,
    modalCanvas: null,
    writer: null,
    writerContainer: null,
    ctx: null,
    gridContainer: null,
    gameMode: "Standard",
    strokeCount: 0,
    dbUser: {},
    isDrawing: false,
    hasMoved: false,
    lastPos: { x: 0, y: 0 },
    initialized: false,
  }).current;
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    if (!isTimerRunning) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimerRunning]);
  const { DIFFICULTIES, SORTED_DIFFICULTIES } = getDifficultyLabels(language);
  // Initialize user data and load first character
  useEffect(() => {
    const init = async () => {
      if (refs.initialized) return;

      setLoading(true);
      try {
        const user = await getCurrentUser();
        let difficulty = 1;
        let target = "";
        let targetId = "";

        if (user?.uid) {
          const dbUser = await getUserById(user.uid);
          refs.dbUser = dbUser;

          if (dbUser?.last_word) {
            const lastChar = await getCharacterById(dbUser.last_word);
            if (lastChar) {
              difficulty = lastChar.difficulty;
              target = lastChar.content;
              targetId = dbUser.last_word;
            }
          }
        }

        const chars = await getDifficultyCharacter(difficulty);
        if (chars?.length) {
          const charMap = chars.reduce((acc, char) => {
            acc[char.id] = char.content;
            return acc;
          }, {});

          setCharData({
            id: targetId,
            content: target,
            difficulty,
            characters: charMap,
          });
        } else {
          throw new Error("No characters available for this difficulty");
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError(String(err));
        setShowModal(true);
      } finally {
        refs.initialized = true;
        setLoading(false);
      }
    };

    init();
  }, []);

  // Initialize canvas context
  useEffect(() => {
    const canvas = refs.canvas;
    if (!canvas || refs.ctx) return;

    canvas.width = CWIDTH;
    canvas.height = CHEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#111827";
    refs.ctx = ctx;
  }, []);

  // Update HanziWriter
  useEffect(() => {
    if (refs.writerContainer && charData.content) {
      refs.writer = testtHanziWriter(refs.writerContainer, charData.content);
    }
  }, [charData.content]);

  // Copy canvas to modal
  useEffect(() => {
    if (showModal && refs.modalCanvas && refs.canvas) {
      const dest = refs.modalCanvas;
      dest.width = refs.canvas.width;
      dest.height = refs.canvas.height;
      const destCtx = dest.getContext("2d");
      destCtx.drawImage(refs.canvas, 0, 0);
    }
  }, [showModal]);

  // Handle grid close on outside click
  useEffect(() => {
    if (!showGrid) return;

    const handleClickOutside = (e) => {
      if (refs.gridContainer && !refs.gridContainer.contains(e.target)) {
        setShowGrid(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGrid]);

  // Canvas drawing handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    refs.isDrawing = true;
    refs.hasMoved = false;
    refs.lastPos = getCanvasPos(e, refs.canvas);
  };

  const handleMouseMove = (e) => {
    if (!refs.isDrawing || !refs.ctx) return;
    const pos = getCanvasPos(e, refs.canvas);
    refs.hasMoved = true;
    refs.ctx.beginPath();
    refs.ctx.moveTo(refs.lastPos.x, refs.lastPos.y);
    refs.ctx.lineTo(pos.x, pos.y);
    refs.ctx.stroke();
    refs.lastPos = pos;
  };

  const handleMouseUp = () => {
    if (refs.isDrawing && refs.hasMoved) {
      refs.strokeCount += 1;
    }
    refs.isDrawing = false;
  };

  // Canvas actions
  const clearDrawing = () => {
    if (refs.canvas && refs.ctx) {
      refs.ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height);
    }
  };

  const resetAll = () => {
    clearDrawing();
    setResult(null);
    setError(null);
    setShowModal(false);
    testModeRefs.current.scores.fill(0);
    testModeRefs.current.images.fill("");
    testModeRefs.current.strokeCounts.fill(0);
    testModeRefs.current.targets.fill("");
    testModeRefs.current.recognized.fill("-");
    testModeRefs.current.feedbacks.fill("No feedbacks");
    refs.strokeCount = 0;
  };

  const animate = () => {
    if (refs.writer) {
      refs.writer.hideCharacter();
      refs.writer.animateCharacter({
        onComplete: () => refs.writer.hideCharacter(),
      });
    }
  };

  // Character navigation
  const findNextIncompleteChar = async (currentId, difficulty) => {
    const completed = refs.dbUser?.completed_words ?? [];
    const chars = await getDifficultyCharacter(difficulty);
    const ids = chars.map((c) => c.id);
    const currentIdx = ids.indexOf(currentId);

    for (let i = 1; i <= ids.length; i++) {
      const idx = (currentIdx + i) % ids.length;
      if (!completed.includes(ids[idx])) {
        return chars[idx];
      }
    }
    return null;
  };

  const handleNextCharacter = async () => {
    setLoading(true);
    setShowModal(false);

    try {
      // Try to find next in current difficulty
      let nextChar = null;

      if (refs.gameMode === "Test(5)") {
        const charArr = Object.keys(charData.characters);
        const curIndex = charArr.indexOf(charData.id);
        const nextIndex = (curIndex + 1) % charArr.length;
        nextChar = { id: charArr[nextIndex] };
      } else {
        nextChar = await findNextIncompleteChar(
          charData.id,
          charData.difficulty
        );
      }

      if (nextChar) {
        handleCharacterChange(nextChar.id);
        setLoading(false);
        return;
      }

      // Find next across all difficulties
      const allChars = [];
      for (const { key } of SORTED_DIFFICULTIES) {
        const chars = await getDifficultyCharacter(key);
        chars.forEach((c) => allChars.push({ ...c, difficulty: key }));
      }

      const completed = refs.dbUser?.completed_words ?? [];
      const currentIdx = allChars.findIndex((c) => c.id === charData.id);

      for (let i = 1; i <= allChars.length; i++) {
        const idx = (currentIdx + i) % allChars.length;
        if (!completed.includes(allChars[idx].id)) {
          nextChar = allChars[idx];
          break;
        }
      }

      if (!nextChar) nextChar = allChars[0];

      if (nextChar.difficulty !== charData.difficulty) {
        await handleDifficultyChange(DIFFICULTIES[nextChar.difficulty]);
      } else {
        handleCharacterChange(nextChar.id);
      }
    } catch (err) {
      console.error("Next character error:", err);
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

  // Mode and difficulty changes
  const handleGameModeChange = async (newMode) => {
    resetAll();
    refs.gameMode = newMode;

    if (newMode === "Standard") {
      setIsTimerRunning(false);
      const completed = refs.dbUser?.completed_words ?? [];
      const chars = await getDifficultyCharacter(charData.difficulty);
      let nextChar = chars[0];

      for (const char of chars) {
        if (!completed.includes(char.id)) {
          nextChar = char;
          break;
        }
      }

      const charMap = chars.reduce((acc, char) => {
        acc[char.id] = char.content;
        return acc;
      }, {});

      setCharData({
        id: nextChar.id,
        content: nextChar.content,
        difficulty: charData.difficulty,
        characters: charMap,
      });
    } else {
      const randomChars = getRandomChars(charData.characters, 5);
      const firstId = Object.keys(randomChars)[0];
      //TODO: fill in stroke count as well
      testModeRefs.current.targets = Object.values(randomChars);

      setCharData((prev) => ({
        ...prev,
        id: firstId,
        content: randomChars[firstId],
        characters: randomChars,
      }));
      setShowModal(true);
      setTimeLeft(TEST_MODE_TIME);
    }
  };

  const handleDifficultyChange = async (newLevel) => {
    setLoading(true);
    const diffEntry = SORTED_DIFFICULTIES.find((d) => d.label === newLevel);

    if (diffEntry.key === charData.difficulty) {
      setLoading(false);
      return;
    }

    try {
      const chars = await getDifficultyCharacter(diffEntry.key);

      if (chars?.length) {
        const charMap = chars.reduce((acc, char) => {
          acc[char.id] = char.content;
          return acc;
        }, {});

        const isTestMode = refs.gameMode === "Test(5)";
        const finalChars = isTestMode ? getRandomChars(charMap, 5) : charMap;
        const firstEntry = Object.entries(finalChars)[0];

        setCharData({
          id: firstEntry[0],
          content: firstEntry[1],
          difficulty: diffEntry.key,
          characters: finalChars,
        });

        resetAll();
      }
    } catch (err) {
      console.error("Error loading characters:", err);
      setError(String(err));
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Evaluation
  const updatePoints = async (points) => {
    if (refs.dbUser?.id && Array.isArray(refs.dbUser.completed_words)) {
      if (!refs.dbUser.completed_words.includes(charData.id)) {
        await updateUser(refs.dbUser.id, {
          points,
          completed_words: [...refs.dbUser.completed_words, charData.id],
          last_word: charData.id,
        });

        updateNavScore(points);
        refs.dbUser = await getUserById(refs.dbUser.id);
      }
    }
  };

  const evaluateFetch = async (image = null, target = null) => {
    //TODO: add check that current stroke-count must be +- 30% of actual stroke-count
    if (refs.gameMode === "Test(5)" && (image == null || target == null)) {
      return { status: "failed" };
    }

    let dataUrl = image ?? refs.canvas.toDataURL("image/jpg");
    const res = await fetch("/api/eval-handwriting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: dataUrl,
        target: target ?? charData.content,
        StrokeCount: refs.strokeCount,
      }),
    });

    let parsed = null;
    const text = await res.text();

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Error");
    }

    if (!res.ok) {
      const msg =
        parsed?.detail ||
        parsed?.error ||
        parsed?.raw ||
        text ||
        "Request failed";
      throw new Error(String(msg));
    }
    return { parsed: parsed, raw: text };
  };
  const handleEvaluate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    if (!canvasHasInk(refs.canvas)) {
      setError("Please draw something before evaluating 🙂");
      setShowModal(true);
      return;
    }
    try {
      const { parsed, raw } = evaluateFetch();

      const finalScore = calcFinalScore(
        parsed.score,
        parsed.recognition_confidence,
        parsed.stroke_estimate,
        parsed.target_match,
        parsed.orientation_ok,
        refs.strokeCount,
        parsed.is_doodle
      );

      if (finalScore >= SCORE_THRESHOLD) {
        await updatePoints(
          (refs.dbUser.points || 0) +
            charData.difficulty * POINTS_PER_WORD_PER_DIFFICULTY
        );
      }

      refs.image = dataUrl;
      setResult({ parsed, raw });
      setShowModal(true);
    } catch (e) {
      setError(String(e));
      setShowModal(true);
    } finally {
      clearDrawing();
      setLoading(false);
    }
  };

  // Render
  return (
    <div className="bg-[var(--tertiary)] w-full h-screen">
      <div className="container m-auto pt-10 max-w-[620px]">
        {/* Header */}
        <div className="flex justify-between pb-1">
          <div className="text-lg flex gap-2 items-center text-[var(--text)]">
            Let's {refs.gameMode === "Standard" ? "try" : "test"} a/an{" "}
            <select
              value={DIFFICULTIES[charData.difficulty]}
              onChange={(e) => handleDifficultyChange(e.target.value)}
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
            </select>
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
                  ref={(el) => (refs.gridContainer = el)}
                  className="absolute top-full left-0 mt-1 p-2 bg-white rounded-md border border-gray-300 shadow-lg z-20"
                >
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 w-sm lg:w-md">
                    {Object.entries(charData.characters).map(
                      ([id, content]) => (
                        <button
                          key={id}
                          onClick={() => handleCharacterChange(id)}
                          disabled={loading}
                          className={`relative !p-0 !m-0 text-lg font-bold rounded-sm border-1 transition-all ${
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
                          {refs.gameMode === "Standard" &&
                            refs.dbUser?.completed_words?.includes(id) && (
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

          <select
            value={refs.gameMode}
            onChange={(e) => handleGameModeChange(e.target.value)}
            disabled={loading}
            className={`pl-2 text-black !pr-0 py-1 rounded-md border-1 border-gray-300 bg-white ${
              loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            {GAME_MODE.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Canvas Area */}
        <div className="relative min-h-[620px] bg-white rounded-md border-gray-300 border-dashed border-4">
          <div
            ref={(el) => (refs.writerContainer = el)}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />

          <div className="absolute right-2 top-2 z-10 flex gap-3 items-center">
            {refs.gameMode === "Test(5)" ? (
              <div className="text-sm font-semibold text-gray-700">
                {Math.floor(timeLeft / 60)}:
                {String(timeLeft % 60).padStart(2, "0")}
              </div>
            ) : (
              <button
                disabled={loading}
                onClick={animate}
                className={`bg-transparent !p-0 text-[var(--primary)] cursor-pointer`}
              >
                <PlayCircle />
              </button>
            )}
          </div>

          <canvas
            width={CWIDTH}
            height={CHEIGHT}
            ref={(el) => (refs.canvas = el)}
            style={{ touchAction: "none" }}
            className={`rounded-md m-auto !p-0 absolute top-0 !bg-transparent cursor-crosshair ${
              loading
                ? "!cursor-not-allowed pointer-events-none opacity-50"
                : ""
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-3">
          <button
            disabled={loading}
            onClick={clearDrawing}
            className={`bg-[var(--primary)] text-white !px-6 !py-2 !rounded-md blue-button ${
              loading ? "!cursor-not-allowed opacity-50" : ""
            }`}
          >
            Clear
          </button>

          {refs.gameMode === "Test(5)" ? (
            <button
              disabled={loading}
              onClick={async () => {
                const charArr = Object.keys(charData.characters);
                const curIndex = charArr.indexOf(charData.id);
                testModeRefs.current.images[curIndex] =
                  refs.canvas.toDataURL("image/jpg");
                //Submit onclick
                if (Object.keys(charData.characters).at(-1) == charData.id) {
                  try {
                    const results = await Promise.allSettled([
                      evaluateFetch(
                        testModeRefs.current.images[0],
                        testModeRefs.current.targets[0]
                      ),
                      evaluateFetch(
                        testModeRefs.current.images[1],
                        testModeRefs.current.targets[1]
                      ),
                      evaluateFetch(
                        testModeRefs.current.images[2],
                        testModeRefs.current.targets[2]
                      ),
                      evaluateFetch(
                        testModeRefs.current.images[3],
                        testModeRefs.current.targets[3]
                      ),
                      evaluateFetch(
                        testModeRefs.current.images[4],
                        testModeRefs.current.targets[4]
                      ),
                    ]);
                    results.forEach((result, index) => {
                      if (result.status === "fulfilled") {
                        const { parsed } = result.value;
                        testModeRefs.current.scores[index] = calcFinalScore(
                          parsed.score,
                          parsed.recognition_confidence,
                          parsed.stroke_estimate,
                          parsed.target_match,
                          parsed.orientation_ok,
                          testModeRefs.current.strokeCounts[index],
                          parsed.is_doodle
                        );
                        testModeRefs.current.feedbacks[index] = parsed.feedback;
                        testModeRefs.current.recognized[index] =
                          parsed.recognized;
                      }
                    });
                    const averageScore =
                      testModeRefs.current.scores.reduce(
                        (accumulator, currentValue) =>
                          accumulator + currentValue,
                        0
                      ) / testModeRefs.current.scores.length;
                    if (averageScore >= SCORE_THRESHOLD) {
                      await updatePoints(
                        (refs.dbUser.points || 0) +
                          charData.difficulty *
                            POINTS_PER_WORD_PER_DIFFICULTY *
                            TEST_MODE_POINT_MULTIPLIER
                      );
                    }
                  } catch {}
                } else {
                  handleNextCharacter();
                }
              }}
              className={`bg-[var(--primary)] text-white !px-8 !rounded-md blue-button ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              {Object.keys(charData.characters).at(-1) == charData.id
                ? "Submit"
                : "Next"}
            </button>
          ) : (
            <button
              disabled={loading}
              onClick={handleEvaluate}
              className={`bg-[var(--primary)] text-white !px-8 !rounded-md blue-button ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              {loading ? "Evaluating…" : "Evaluate"}
            </button>
          )}
        </div>

        {/* Result Modal */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 relative">
              <button
                onClick={() => {
                  if (refs.gameMode === "Test(5)") {
                    handleGameModeChange("Standard");
                  }
                }}
                className="absolute z-50 rounded-full !p-0 bg-white top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>

              {/* Evaluation Modal */}
              {error ? (
                <div className="text-black">
                  <h2 className="text-2xl font-bold pb-2">
                    Somethings wrong...
                  </h2>{" "}
                  {error}
                </div>
              ) : result?.parsed ? (
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold pb-2">
                    {calcFinalScore(
                      result.parsed.score,
                      result.parsed.recognition_confidence,
                      result.parsed.stroke_estimate,
                      result.parsed.target_match,
                      result.parsed.orientation_ok,
                      refs.strokeCount,
                      result.parsed.is_doodle
                    ) >= SCORE_THRESHOLD
                      ? "Nice!"
                      : "Do better😞"}
                  </h2>
                  <div className="flex justify-center p-0 border-gray-300 border-dashed border-3 rounded-md bg-gray-50 relative overflow-hidden">
                    <img src={refs.image} alt="drawing" />
                  </div>

                  <div>
                    <p>
                      <b>Score:</b>{" "}
                      {(() => {
                        const score = calcFinalScore(
                          result.parsed.score,
                          result.parsed.recognition_confidence,
                          result.parsed.stroke_estimate,
                          result.parsed.target_match,
                          result.parsed.orientation_ok,
                          refs.strokeCount,
                          result.parsed.is_doodle
                        );
                        return Number.isFinite(score)
                          ? `${Math.round(score * 10) / 10}/100${
                              score >= SCORE_THRESHOLD
                                ? ` (+${
                                    charData.difficulty *
                                    POINTS_PER_WORD_PER_DIFFICULTY
                                  })`
                                : ""
                            }`
                          : "—";
                      })()}
                    </p>
                    <p>
                      <b>Target:</b> {charData.content} (
                      {result.parsed.definition})
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
                      onClick={resetAll}
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
              ) : refs.gameMode === "Test(5)" ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold pb-2">
                      Welcome to Test Mode!
                    </h2>
                    <p className="">
                      You’ve got {TEST_MODE_TIME} seconds to write 5 characters
                      and score 1.5× points compared to Standard Mode—good luck
                      😊!
                    </p>
                  </div>
                  <div className="w-full flex justify-between items-center gap-3">
                    <button
                      onClick={() => {
                        resetAll();
                        handleGameModeChange("Standard");
                      }}
                      className={`bg-[var(--primary)] text-white !px-8 !rounded-md`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setTimeout(() => {
                          setIsTimerRunning(true);
                        }, 1000);
                      }}
                      className={`bg-[var(--primary)] text-white !px-8 !rounded-md`}
                    >
                      Start now
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
      </div>
    </div>
  );
};

export default PlayPage;
