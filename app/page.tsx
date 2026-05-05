import Hero from "./components/hero";
import Markets from "./components/markets";
import Portfolio from "./components/portfolio";
import HowItWorks from "./components/how-it-works";
import Footer from "./components/footer";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-white">
      <Hero />
      <Markets />
      <Portfolio />
      <HowItWorks />
      <Footer />
    </div>
  );
}
