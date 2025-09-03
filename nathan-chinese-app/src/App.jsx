import { BookOpen, Smartphone, CheckSquare, Gift } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--primary)]">
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
          <p className="text-lg max-w-2xl mb-8">
            Learn or improve your Chinese writing skill with our fun interactive
            app.
          </p>
          <button className="bg-[var(--primary)] text-[var(--background)] shadow-md">
            Learn now
          </button>
          <button className="ml-8 bg-[var(--background)] text-[var(--accent)] shadow-md">
            More info
          </button>
        </div>
        <div className="flex justify-center md:w-1/3 lg:w-1/2 min-h-72">
          <div className="w-full shadow-lg rounded-2xl flex items-center justify-center">
            <span>[ Demo Illustration ]</span>
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
            icon={<Smartphone className="w-10 h-10" />}
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
      <section className="bg-[var(--accent)] py-16 text-center">
        <h2 className="text-4xl font-bold mb-4 !text-[var(--background)]">
          Ready to Begin?
        </h2>
        <p className="mb-8 !text-[var(--background)]">
          Start mastering Kanji & Chinese writing today!
        </p>
        <button className="bg-[var(--background)] text-[var(--accent)] px-8 py-3 rounded-2xl font-medium shadow-md hover:bg-background">
          Get Started
        </button>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-[var(--background)] backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="mb-6 flex justify-center">{icon}</div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-text/70 leading-relaxed text-[var(--text)]">{desc}</p>
    </div>
  );
}
