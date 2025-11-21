import { useEffect, useRef, useState } from "react";
import { testtHanziWriter } from "../utils/hanzi";
import { getCurrentUser } from "./Login";
import {
  getCharacterById,
  getDifficultyCharacter,
  getUserById,
  updateUser,
} from "../firebase/database";
import "react-slideshow-image/dist/styles.css";
import { ChevronLeft, ChevronRight, PlayCircle, X } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { Slide } from "react-slideshow-image";
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
// Constants
const CWIDTH = 650;
const CHEIGHT = 620;
const POINTS_PER_WORD_PER_DIFFICULTY = 30;
const TEST_MODE_TIME = 40;
const TEST_MODE_POINT_MULTIPLIER = 1.5;
const SCORE_THRESHOLD = 65;

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

const getCanvasSize = () => {
  const width = window.innerWidth < 600 ? 250 : 650;
  return { width, height: width };
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

const calcFinalScore = (score, confidence, stroke = 1, expectedStroke = 1) => {
  const finalScore = score * confidence * (stroke / expectedStroke);
  return finalScore;
};

// Main Component
const PlayPage = ({ updateNavScore }) => {
  // State
  const [charData, setCharData] = useState({
    id: "",
    content: "",
    difficulty: 1,
    showCharacters: {},
    characters: {},
  });
  const [loading, setLoading] = useState(false);

  // const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TEST_MODE_TIME);
  const [language, setLanguage] = useState("Japanese");

  const finalScore = useRef(0);
  const refs = useRef({
    canvas: null,
    images: new Array(5).fill(""),
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
    results: [], //{score: , confidence: , feedback: , target: }
  }).current;
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const { DIFFICULTIES, SORTED_DIFFICULTIES } = getDifficultyLabels(language);
  // Initialize user data and load first character
  useEffect(() => {
    const init = async () => {
      if (refs.initialized) return;

      setLoading(true);
      try {
        const user = await getCurrentUser();
        let difficulty = 1;
        let target = "右";
        let targetId = "2UrPjFYn9j62Q1K29AyW";
        let initialLanguage = "Japanese";
        if (user?.uid && !user?.isGuest) {
          const dbUser = await getUserById(user.uid);
          const date = new Date();
          await updateUser(user.uid, {
            last_played_at: Math.floor(date.getTime() / 1000),
          });
          refs.dbUser = dbUser;
          initialLanguage = dbUser.language;
          if (dbUser?.last_word) {
            const lastChar = await getCharacterById(dbUser.last_word);
            if (lastChar) {
              difficulty = lastChar.difficulty;
              target = lastChar.content;
              targetId = dbUser.last_word;
            }
          }
        }

        const chars = await getDifficultyCharacter(difficulty, initialLanguage);
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
            showCharacters: charMap,
          });
        } else {
          throw new Error("No characters available for this difficulty");
        }
        setLanguage(initialLanguage);
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
      const { width, height } = getCanvasSize();
      refs.writer = testtHanziWriter(
        refs.writerContainer,
        charData.content,
        width,
        height
      );
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
    setError(null);
    setShowModal(false);
    setTimeLeft(TEST_MODE_TIME);
    setIsTimerRunning(false);
    refs.results = [];
    refs.images = new Array(5).fill("");
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

    const ids = Object.keys(charData.characters);
    const curIdx = ids.indexOf(currentId);
    for (let i = curIdx + 1; i < ids.length; i++) {
      const ch = charData.characters[ids[i]][0];
      if (!completed.includes(ch)) {
        return { id: ids[i] };
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

      if (refs.gameMode === "Test") {
        const charArr = Object.keys(charData.showCharacters);
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
        const chars = await getDifficultyCharacter(key, language);
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
      const completed = refs.dbUser?.completed_words ?? [];
      const chars = Object.entries(charData.characters);
      let nextCharId = chars[0];
      let nextCharContent = chars[1];
      for (const [id, content] of chars) {
        if (!completed.includes(id)) {
          nextCharId = id;
          nextCharContent = content;
          break;
        }
      }

      setCharData((prev) => ({
        ...prev,
        id: nextCharId,
        content: nextCharContent,
        difficulty: charData.difficulty,
        showCharacters: prev.characters,
      }));
    } else {
      const randomChars = getRandomChars(charData.characters, 5);
      const firstId = Object.keys(randomChars)[0];

      setCharData((prev) => ({
        ...prev,
        id: firstId,
        content: randomChars[firstId],
        showCharacters: randomChars,
      }));
      setShowModal(true);
      setTimeLeft(TEST_MODE_TIME);
    }
  };

  const handleDifficultyChange = async (newLevel) => {
    setLoading(true);
    const diffEntry = SORTED_DIFFICULTIES.find((d) => d.label === newLevel);
    const isTestMode = refs.gameMode === "Test";
    if (diffEntry.key === charData.difficulty && !isTestMode) {
      setLoading(false);
      return;
    }

    try {
      const chars = await getDifficultyCharacter(diffEntry.key, language);

      if (chars?.length) {
        const charMap = chars.reduce((acc, char) => {
          acc[char.id] = char.content;
          return acc;
        }, {});

        const finalChars = isTestMode ? getRandomChars(charMap, 5) : charMap;
        const firstEntry = Object.entries(finalChars)[0];

        setCharData({
          id: firstEntry[0],
          content: firstEntry[1],
          difficulty: diffEntry.key,
          showCharacters: finalChars,
          characters: charMap,
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

  const evaluateFetch = async (image, target) => {
    const extractJSON = (text) => {
      // Find the first opening brace and last closing brace
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");

      if (start === -1 || end === -1) {
        throw new Error("No JSON object found in model response.");
      }

      const jsonString = text.substring(start, end + 1);

      // Remove BOM + zero-width chars
      return jsonString
        .replace(/\uFEFF/g, "")
        .replace(/[\u200B-\u200F]/g, "")
        .trim();
    };
    if (image.trim() === "") {
      return {
        score: 0,
        confidence: 1,
        feedback: "You didn't write anything here",
      };
    }
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
      You are a chinese and japanese kanji handwriting evaluation model. 
      You will be given:
        - A dataURL of a handwritten character.
        - A TARGET CHARACTER the handwriting is supposed to represent.
  
      The target character is: "${target}"
  
      Your tasks:
      1. How accurate and readable the character is written.
      2. How similar it is to the correct standard form.
      
      Return ONLY a JSON object with EXACTLY these fields:
      {
        "feedback": string, // detailed, concise and short feedback on stroke order, stroke ratio, proportions, orientation, accuracy within 300 characters
        "score": number     // 0–100 similarity score
        "confidence": float // 0–1 model confidence in the score (may include decimals)
      }
      `,
              },
              {
                inlineData: {
                  mimeType: "image/jpeg", // or image/jpeg depending on your dataURL
                  data: image.split(",")[1], // remove "data:image/...;base64,"
                },
              },
            ],
          },
        ],
      });
      const raw = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = JSON.parse(extractJSON(raw));
      return parsed;
    } catch (e) {
      console.error(e);
      setError(String(e));
    }

    return {
      score: 0,
      confidence: 1,
      feedback: "You didn't write anything here",
    };
  };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const handleEvaluate = async () => {
    setLoading(true);
    setError(null);

    try {
      if (refs.gameMode === "Standard") {
        if (!canvasHasInk(refs.canvas)) {
          setError("Please draw something before evaluating 🙂");
          setShowModal(true);
          return;
        }
        const image = refs.canvas.toDataURL();
        const res = await evaluateFetch(image, charData.content);

        refs.images = [image];
        refs.results = [{ ...res, target: charData.content }];
        finalScore.current = calcFinalScore(res.score, res.confidence, 1, 1);
        if (finalScore.current >= SCORE_THRESHOLD) {
          await updatePoints(
            (refs.dbUser.points || 0) +
              charData.difficulty * POINTS_PER_WORD_PER_DIFFICULTY
          );
        }
      } else {
        const chs = Object.values(charData.showCharacters);
        const results = await Promise.allSettled([
          refs.images[0].trim() === ""
            ? Promise.resolve({
                score: 0,
                confidence: 1,
                feedback: "You didn't write anything here",
              })
            : evaluateFetch(refs.images[0], chs[0]),

          refs.images[1].trim() === ""
            ? Promise.resolve({
                score: 0,
                confidence: 1,
                feedback: "You didn't write anything here",
              })
            : delay(400).then(() => evaluateFetch(refs.images[1], chs[1])),

          refs.images[2].trim() === ""
            ? Promise.resolve({
                score: 0,
                confidence: 1,
                feedback: "You didn't write anything here",
              })
            : delay(800).then(() => evaluateFetch(refs.images[2], chs[2])),

          refs.images[3].trim() === ""
            ? Promise.resolve({
                score: 0,
                confidence: 1,
                feedback: "You didn't write anything here",
              })
            : delay(1200).then(() => evaluateFetch(refs.images[3], chs[3])),

          refs.images[4].trim() === ""
            ? Promise.resolve({
                score: 0,
                confidence: 1,
                feedback: "You didn't write anything here",
              })
            : delay(1600).then(() => evaluateFetch(refs.images[4], chs[4])),
        ]);

        let totalScore = 0;
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            const parsed = result.value;
            totalScore += calcFinalScore(parsed.score, parsed.confidence);
            refs.results[index] = { ...parsed, target: chs[index] };
          }
        });
        finalScore.current = totalScore / results.length;
        if (finalScore.current >= SCORE_THRESHOLD) {
          await updatePoints(
            (refs.dbUser.points || 0) +
              charData.difficulty *
                POINTS_PER_WORD_PER_DIFFICULTY *
                5 *
                TEST_MODE_POINT_MULTIPLIER
          );
        }
      }
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setShowModal(true);
      clearDrawing();
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!isTimerRunning) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;

        if (newTime === 0) {
          clearInterval(timer);
          setIsTimerRunning(false);
          handleEvaluate();
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, handleEvaluate]);
  // Render
  return (
    <div className="bg-[var(--tertiary)] w-full overflow-x-hidden overflow-y-hidden pb-8">
      <div className="container m-auto pt-6 max-w-[650px] px-4">
        {/* Header — compact & mobile friendly */}
        <div className="flex justify-between items-start gap-2">
          <div className="text-lg flex flex-wrap gap-2 pb-1 items-center text-[var(--text)]">
            Let's try a{" "}
            <select
              value={DIFFICULTIES[charData.difficulty]}
              onChange={async (e) => {
                await handleDifficultyChange(e.target.value);

                if (refs.gameMode === "Test") {
                  setShowModal(true);
                }
              }}
              disabled={loading}
              className={`pl-2 !pr-0 py-1 rounded-md border-1 border-gray-300 bg-white text-sm ${
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
                className={`!px-2 !py-0 border !rounded-md border-gray-300 bg-white text-sm ${
                  loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
              >
                {charData.content || ""}
              </button>

              {showGrid && (
                <div
                  ref={(el) => (refs.gridContainer = el)}
                  className="absolute top-full left-0 p-2 bg-white rounded-md border border-gray-300 shadow-lg z-20 max-h-[300px] overflow-y-auto w-56 md:w-80 lg:w-96"
                >
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
                    {Object.entries(charData.showCharacters).map(
                      ([id, content]) => (
                        <button
                          key={id}
                          onClick={() => {
                            if (
                              refs.gameMode === "Test" &&
                              canvasHasInk(refs.canvas)
                            ) {
                              const charArr = Object.keys(
                                charData.showCharacters
                              );
                              const curIndex = charArr.indexOf(id);
                              refs.images[curIndex] =
                                refs.canvas.toDataURL("image/jpg");
                            }
                            handleCharacterChange(id);
                          }}
                          disabled={loading}
                          className={`relative !p-0 !m-0 text-lg font-bold rounded-sm border-1 transition-all flex items-center justify-center h-10 w-10 ${
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
            onChange={(e) => {
              handleGameModeChange(e.target.value);
            }}
            disabled={loading}
            className={`pl-2 text-black !pr-0 py-1 rounded-md border-1 border-gray-300 bg-white text-sm ${
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

        {/* Canvas Area — mobile-friendly: min height so canvas is usable on small screens */}
        <div className="relative min-h-[620px] bg-white rounded-md border-gray-300 border-dashed border-4 pt-2 overflow-hidden">
          <div
            ref={(el) => (refs.writerContainer = el)}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />

          {/* top-right controls */}
          <div className="absolute right-2 top-2 z-10 flex gap-3 items-center">
            {refs.gameMode === "Test" ? (
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
            className={`rounded-md m-auto !p-0 absolute top-0 left-0 w-full h-full !bg-transparent cursor-crosshair ${
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

        {/* Action Buttons — stacked nicely on mobile */}
        <div className="flex flex-col sm:flex-row justify-between pt-2 gap-3">
          <div className="flex gap-2 justify-center sm:justify-start">
            <button
              disabled={loading}
              onClick={clearDrawing}
              className={`bg-[var(--primary)] text-white !px-6 !py-2 !rounded-md blue-button ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              Clear
            </button>
          </div>

          {refs.gameMode === "Test" ? (
            <button
              disabled={loading}
              onClick={async () => {
                const charArr = Object.keys(charData.showCharacters);
                if (canvasHasInk(refs.canvas)) {
                  const curIndex = charArr.indexOf(charData.id);
                  refs.images[curIndex] = refs.canvas.toDataURL("image/jpg");
                }

                if (charArr.at(-1) == charData.id) {
                  if (refs.images.every((el) => el === "")) {
                    setError(
                      "We think its cause you didn't write anything. Unfortunately, you got 0/100 😢"
                    );
                    setShowModal(true);
                    return;
                  }
                  setIsTimerRunning(false);
                  handleEvaluate();
                } else {
                  handleNextCharacter();
                }
              }}
              className={`bg-[var(--primary)] text-white !px-8 !rounded-md blue-button ${
                loading ? "!cursor-not-allowed opacity-50" : ""
              }`}
            >
              {Object.keys(charData.showCharacters).at(-1) == charData.id
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
              Submit
            </button>
          )}
        </div>

        {/* Result Modal — mobile-optimized */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={async () => {
                  if (refs.gameMode === "Test") {
                    handleGameModeChange("Standard");
                    return;
                  }
                  setLoading(false);
                  setShowModal(false);
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
              ) : refs.results.length ? (
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold pb-1">
                    {finalScore.current >= SCORE_THRESHOLD
                      ? `Nice! (+${
                          refs.gameMode === "Standard"
                            ? charData.difficulty *
                              POINTS_PER_WORD_PER_DIFFICULTY
                            : charData.difficulty *
                              POINTS_PER_WORD_PER_DIFFICULTY *
                              5 *
                              TEST_MODE_POINT_MULTIPLIER
                        }pts)`
                      : refs.gameMode === "Test"
                      ? `Do better😞 (Avg: ${
                          Math.round(finalScore.current * 10) / 10
                        })`
                      : "Do better😞"}
                  </h2>
                  <Slide
                    autoplay={false}
                    arrows={refs.gameMode === "Test"}
                    transitionDuration={350}
                    prevArrow={
                      <button className="-ml-7 text-center opacity-30 hover:opacity-100 !p-0 text-black">
                        <ChevronLeft size={30} />
                      </button>
                    }
                    nextArrow={
                      <button className="-mr-7 text-center opacity-30 hover:opacity-100 !p-0 text-black">
                        <ChevronRight size={30} />
                      </button>
                    }
                    indicators={refs.gameMode === "Test"}
                  >
                    {refs.results.map((res, index) => {
                      return (
                        <div
                          key={index}
                          className=" overflow-hidden flex flex-col justify-between gap-1"
                        >
                          <div className=" w-full !p-0 border-gray-300 border-dashed border-3 rounded-md bg-gray-50 relative overflow-hidden">
                            {refs.images[index].trim() === "" ? (
                              <div className="w-full h-40 flex items-center justify-center text-gray-400">
                                No drawing
                              </div>
                            ) : (
                              <img
                                src={refs.images[index]}
                                alt="drawing"
                                className="w-full h-auto"
                              />
                            )}
                          </div>

                          <div>
                            <p>
                              <b>Score:</b>{" "}
                              {Number.isFinite(res.score)
                                ? `${
                                    Math.round(
                                      res.score * res.confidence * 10
                                    ) / 10
                                  }/100`
                                : "—"}
                            </p>
                            <p>
                              <b>Target:</b> {res.target ?? "—"}
                            </p>

                            <p className="text-sm">
                              <b>Feedback:</b> {res.feedback ?? "—"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </Slide>

                  <div className="w-full flex justify-between items-center gap-3">
                    <button
                      disabled={loading}
                      onClick={async () => {
                        resetAll();
                        if (refs.gameMode === "Test") {
                          const randomChars = getRandomChars(
                            charData.characters,
                            5
                          );
                          const firstId = Object.keys(randomChars)[0];

                          setCharData((prev) => ({
                            ...prev,
                            id: firstId,
                            content: randomChars[firstId],
                            showCharacters: randomChars,
                          }));
                          setShowModal(true);
                          setTimeLeft(TEST_MODE_TIME);
                        }
                      }}
                      className={`bg-[var(--primary)] text-white !px-8 !rounded-md ${
                        loading ? "!cursor-not-allowed opacity-50" : ""
                      }`}
                    >
                      Try again
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => {
                        if (refs.gameMode === "Test") {
                          handleGameModeChange("Standard");
                          return;
                        }
                        handleNextCharacter();
                      }}
                      className={`bg-[var(--primary)] text-white !px-8 !rounded-md ${
                        loading ? "!cursor-not-allowed opacity-50" : ""
                      }`}
                    >
                      {refs.gameMode === "Test" ? "Go to standard" : "Next"}
                    </button>
                  </div>
                </div>
              ) : refs.gameMode === "Test" ? (
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
                        }, 600);
                      }}
                      className={`bg-[var(--primary)] text-white !px-8 !rounded-md`}
                    >
                      Start now
                    </button>
                  </div>
                </div>
              ) : (
                <div>Could not parse JSON.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayPage;
