import { useState, useEffect, createContext, useContext } from "react";
import HomePage from "./pages/Home";
import LoginPage from "./pages/Login";
import PlayPage from "./pages/Play";
const RouterContext = createContext();
const AuthContext = createContext();

function Router({ children }) {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

function Route({ path, component: Component }) {
  const { currentPath } = useContext(RouterContext);
  return currentPath === path ? <Component /> : null;
}

function Link({ to, children, className = "" }) {
  const { navigate } = useContext(RouterContext);

  const handleClick = (e) => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize Google Auth
  useEffect(() => {
    const initGoogleAuth = async () => {
      try {
        // setLoading(true)
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initGoogleAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // setLoading(true);
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
function Navbar() {
  return (
    <nav className="backdrop-blur-sm border-b border-gray-200 w-full bg-white fixed top-0 shadow-md ">
      <div className="container mx-auto py-3 px-6 flex justify-between items-center w-full">
        <Link
          to="/"
          className="!px-0 text-2xl !font-bold text-[var(--primary)]"
        >
          KanjiMaster
        </Link>

        <Link to="/login" className=" bg-[var(--primary)] text-white">
          Sign In
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-white">
          <Navbar />
          <main>
            <Route path="/" component={HomePage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/play" component={PlayPage} />
            {/* <Route path="/dashboard" component={DashboardPage} /> */}
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export { Link, useAuth, RouterContext };
