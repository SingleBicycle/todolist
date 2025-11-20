import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getCurrentUser,
  loginAnonymously,
  loginWithGoogle,
  logout,
} from "../firebase/auth";
import { getUserById } from "../firebase/database";

const LoginPage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const setIsLoggedInWithUser = async () => {
      const user = await getCurrentUser();
      setIsLoggedIn(user != null);
    };
    setIsLoggedInWithUser();
  }, []);
  const handleGoogleSignIn = async () => {
    await loginWithGoogle();
    const currentUser = await getCurrentUser();
    if (currentUser == null) {
      return;
    }
    const user = await getUserById(currentUser.uid);
    if (user.username === undefined) {
      navigate(`/profile/${user.id}/edit`, {
        state: {
          firstTimeSignIn: true,
        },
      });
    } else {
      navigate("/play");
    }
  };

  const handleGuestLogin = async () => {
    await loginAnonymously();
    navigate("/play");
  };

  return (
    <div className="!overflow-y-hidden min-h-screen bg-[var(--tertiary)] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center pb-8">
          <h2 className="text-3xl font-bold pb-2">Welcome!</h2>
          <p className="text-gray-600">
            Sign in to start your learning journey
          </p>
        </div>

        <button
          onClick={isLoggedIn ? logout : handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-xl px-6 py-3 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 !disabled:cursor-not-allowed pb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285f4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34a853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#fbbc05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#ea4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLoggedIn ? "Sign out" : "Continue with Google"}
        </button>

        <div className="relative p-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">or</span>
          </div>
        </div>

        <button
          onClick={handleGuestLogin}
          className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors border border-gray-200"
        >
          Continue as Guest
        </button>

        <div className="pt-6 text-center">
          <Link to="/" className="text-[var(--primary)] hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

export { getCurrentUser };
