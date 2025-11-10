import { BookOpen, Smartphone, CheckSquare, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser } from "./Login";

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-white backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-4 sm:p-6 md:p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="mb-4 md:mb-6 flex justify-center text-[var(--primary)]">
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-semibold mb-2 md:mb-3">{title}</h3>
      <p className="text-text/70 leading-relaxed text-sm sm:text-base text-[var(--text)]">{desc}</p>
    </div>
  );
}

const HomePage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const setIsLoggedInWithUser = async () => {
      const user = await getCurrentUser();
      setIsLoggedIn(user != null);
    };
    setIsLoggedInWithUser();
  }, []);

  return (
    <div className="min-h-screen pt-16 sm:pt-20 md:pt-24 bg-[var(--tertiary)]">
      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24 text-center md:text-left w-full flex flex-col md:flex-row justify-between gap-6 sm:gap-8">
        <div className="w-full md:w-2/3 lg:w-1/2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
            Master Kanji & Chinese Writing
          </h1>
          <p className="!text-gray-600 text-base sm:text-lg max-w-2xl mb-6 sm:mb-8">
            Learn or improve on your Chinese writing skill and see how you stack
            against your friends globally.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center md:justify-start">
            <Link
              to={isLoggedIn ? "/play" : "/login"}
              className="bg-[var(--primary)] text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl font-medium shadow-md hover:bg-[var(--accent-primary)] transition-all duration-200 ease-in-out w-full sm:w-auto text-center"
            >
              Play now
            </Link>
            <Link 
              to={"/scoreboard"} 
              className="blue-button w-full sm:w-auto text-center"
            >
              See scoreboard
            </Link>
          </div>
        </div>
        <div className="flex justify-center md:w-1/3 lg:w-1/2 min-h-48 sm:min-h-64 md:min-h-72">
          <div className="text-center p-6 sm:p-8 w-full shadow-lg rounded-2xl bg-white flex items-center justify-center">
            <div>
              <p className="text-5xl sm:text-6xl md:text-7xl mb-3 sm:mb-4">漢</p>
              <span className="text-gray-600 text-sm sm:text-base">[ Demo Illustration ]</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-10 md:mb-12">
          Why Choose Our App?
        </h2>
        <div className="grid gap-4 sm:gap-6 md:gap-10 sm:grid-cols-2">
          <FeatureCard
            icon={<BookOpen className="w-8 h-8 sm:w-10 sm:h-10" />}
            title="Stroke Order Guides"
            desc="Practice with correct stroke orders "
          />
          <FeatureCard
            icon={<CheckSquare className="w-8 h-8 sm:w-10 sm:h-10" />}
            title="Pinpoint Accuracy"
            desc="Trace and check accuracy with AI"
          />
          <FeatureCard
            icon={<Smartphone className="w-8 h-8 sm:w-10 sm:h-10" />}
            title="Mobile Ready"
            desc="Learn anytime, anywhere on any device."
          />
          <FeatureCard
            icon={<Gift className="w-8 h-8 sm:w-10 sm:h-10" />}
            title="All Free"
            desc="All features are forever free."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--primary)] py-12 sm:py-14 md:py-16 text-center px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 !text-white">
          Ready to Begin Your Journey?
        </h2>
        <p className="mb-6 sm:mb-8 !text-white text-sm sm:text-base">
          Start mastering Kanji & Chinese writing today!
        </p>
        <Link
          to={isLoggedIn ? "/play" : "/login"}
          className="inline-block bg-white text-[var(--primary)] px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl font-medium shadow-md hover:bg-background transition-all"
        >
          Get Started
        </Link>
      </section>
    </div>
  );
};

export default HomePage;