import { useState, useEffect, createContext, useContext, useRef } from "react";
import HomePage from "./pages/Home";
import LoginPage from "./pages/Login";
import PlayPage from "./pages/Play";
import ProfilePage from "./pages/Profile";
import { LogOut } from "lucide-react";
import ScoreBoardPage from "./pages/ScoreBoard";
import { logout } from "./firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";
import { auth } from "./firebase/config";
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';

import axios from "axios";

function Navbar({ user, isLoading }) {
  // ✅ CHANGED: prop name is `isLoading` (was `isLoadingProfile`)
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
                  {user.isGuest ? "Guest" : "4534.4pts"}
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          email: firebaseUser.email,
          isGuest: firebaseUser.displayName == null,
        });
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
        <Navbar user={user} isLoading={isLoading} />

        <main className="mt-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/scoreboard" element={<ScoreBoardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
