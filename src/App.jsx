import { useState, useEffect, useRef } from "react";
import HomePage from "./pages/Home";
import LoginPage from "./pages/Login";
import PlayPage from "./pages/Play";
import ProfilePage from "./pages/Profile";
import { LogOut } from "lucide-react";
import ScoreBoardPage from "./pages/ScoreBoard";
import { getCurrentUser, logout } from "./firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";
import { auth } from "./firebase/config";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import { getUserById } from "./firebase/database";
// components/AnimatedCounter.tsx

function AnimatedCounter({ value, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const start = Number(node.innerText) || 0;
    const end = value;
    if (start === end) return;

    const duration = 1200; // ms
    const startTime = performance.now();

    const step = (t) => {
      const progress = Math.min((t - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(start + (end - start) * eased);
      node.innerText = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  return <span ref={ref} className={className} />;
}

function Navbar({ user, isLoading, score }) {
  const [isDroppedDown, setIsDroppedDown] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsDroppedDown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="backdrop-blur-sm border-b z-50 border-gray-200 w-full bg-white fixed top-0 shadow-md">
      <div className="container mx-auto py-3 px-6 flex justify-between items-center w-full">
        <Link
          to="/"
          className="!px-0 text-2xl !font-bold text-[var(--primary)]"
        >
          {import.meta.env.VITE_APP_NAME}
        </Link>

        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--primary)] rounded-full animate-spin" />
          ) : user === null ? (
            <Link
              to="/login"
              className="bg-[var(--primary)] text-white px-4 py-2 rounded-md"
            >
              Sign In
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <div className="flex justify-center items-center gap-3">
                <p className="font-semibold text-md -mb-2">
                  {user.isGuest ? (
                    "Guest"
                  ) : (
                    <span>
                      {score == 0 ? score : <AnimatedCounter value={score} />}
                      pts
                    </span>
                  )}
                </p>
                <div
                  onClick={() => setIsDroppedDown((prev) => !prev)}
                  className="cursor-pointer overflow-clip rounded-full shadow-md border !p-0 border-gray-200 w-12 h-12 flex items-center justify-center"
                >
                  <img
                    src={user.photoURL || anonymousPfp}
                    alt="profile"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {isDroppedDown && (
                <div className="absolute shadow-md rounded-lg ml-3 mt-3 bg-white">
                  <button
                    onClick={() => navigate("/profile")}
                    className="flex items-center text-sm text-gray-700 !px-6 !rounded-lg text-nowrap hover:bg-gray-50"
                  >
                    Profile
                  </button>
                  <button
                    onClick={async () => {
                      const { success } = await logout();
                      if (success) navigate("/");
                    }}
                    className="flex items-center text-sm text-gray-700 !px-6 !rounded-lg text-nowrap hover:bg-gray-50"
                  >
                    <LogOut className="w-4 mr-2" /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setLoading] = useState(true);

  const [score, setScore] = useState(0);
  useEffect(() => {
    const fetchInitialScore = async () => {
      const user = await getCurrentUser();

      if (user?.uid) {
        const savedScore = (await getUserById(user.uid)).points; // your async function
        setScore(savedScore);
      }
    };

    fetchInitialScore();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          email: firebaseUser.email,
          isGuest: firebaseUser.displayName == null,
        });
        fetchInitialScore();
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white pt-[64px]">
        <Navbar user={user} isLoading={isLoading} score={score} />

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/play"
              element={
                <PlayPage updateNavScore={(newScore) => setScore(newScore)} />
              }
            />
            <Route path="/scoreboard" element={<ScoreBoardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
