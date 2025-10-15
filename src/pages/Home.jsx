import { BookOpen, Smartphone, CheckSquare, Gift } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from "react";
import { getCurrentUser } from "./Login";
function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-white backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="mb-6 flex justify-center text-[var(--primary)]">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-text/70 leading-relaxed text-[var(--text)]">{desc}</p>
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
    <div className="min-h-screen pt-24 bg-[var(--tertiary)]">
      {/* Hero Section */}
      <section
        className="container mx-auto px-6 py-24 md:text-left text-center w-full flex flex-col
  md:flex-row justify-between gap-8"
      >
        <div className="w-full md:w-2/3 lg:w-1/2">
          <h1
            className="text-6xl leading-16
       font-bold mb-6"
          >
            Master Kanji & Chinese Writing
          </h1>
          <p className="!text-gray-600 text-lg max-w-2xl mb-8">
            Learn or improve your Chinese writing skill with our fun interactive
            app.
          </p>
          <Link
            to={isLoggedIn ? "/play" : "/login"}
            className=" bg-[var(--primary)] text-white shadow-md"
          >
            Learn now
          </Link>
          <Link
            to={"/scoreboard"}
            className="ml-8 bg-[var(--primary)] text-white shadow-md"
          >
            Scoreboard
          </Link>
        </div>
        <div className="flex justify-center md:w-1/3 lg:w-1/2 min-h-72">
          <div className="text-center p-8 w-full shadow-lg rounded-2xl bg-white flex items-center justify-center">
            <div>
              <p className="text-7xl mb-4">漢</p>
              <span className="text-gray-600">[ Demo Illustration ]</span>
            </div>
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-12">
          Why Choose Our App?
        </h2>
        <div className="grid gap-10 md:grid-cols-2">
          <FeatureCard
            icon={<BookOpen className="w-10 h-10" />}
            title="Stroke Order Guides"
            desc="Practice with correct stroke orders "
          />
          <FeatureCard
            icon={<CheckSquare className="w-10 h-10" />}
            title="Pinpoint Accuracy"
            desc="Trace and check accuracy with AI"
          />
          <FeatureCard
            icon={<Smartphone className="w-10 h-10 " />}
            title="Mobile Ready"
            desc="Learn anytime, anywhere on any device."
          />
          <FeatureCard
            icon={<Gift className="w-10 h-10" />}
            title="All Free"
            desc="All features are forever free."
          />
        </div>
      </section>
      {/* CTA */}
      <section className="bg-[var(--primary)] py-16 text-center">
        <h2 className="text-4xl font-bold mb-4 !text-white">
          Ready to Begin Your Journey?
        </h2>
        <p className="mb-8 !text-white">
          Start mastering Kanji & Chinese writing today!
        </p>
        <Link
          to={isLoggedIn ? "/play" : "/login"}
          className="bg-white text-[var(--primary)] px-8 py-3 rounded-2xl font-medium shadow-md hover:bg-background"
        >
          Get Started
        </Link>
      </section>
    </div>
  );
};

export default HomePage;
