import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { HeroCinematic } from "@/components/feature/HeroCinematic";
import { AwakeningAct } from "@/components/feature/AwakeningAct";
import { IntelligencesAct } from "@/components/feature/IntelligencesAct";
import { PathAct } from "@/components/feature/PathAct";
import { PlansAct } from "@/components/feature/PlansAct";

const LandingPage = () => {
  return (
    <div className="min-h-[100dvh] relative bg-darker selection:bg-gold/30 font-sans text-textMain">
      {/* Background grid sutil — fixed para sensación de profundidad cinematic */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
      />
      {/* Glow gold del hero — solo desktop (perf mobile) */}
      <div
        aria-hidden
        className="hidden md:block fixed top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-gold opacity-[0.12] blur-[150px] pointer-events-none"
      />

      <Header />

      <main>
        <HeroCinematic />
        <AwakeningAct />
        <IntelligencesAct />
        <PathAct />
        <PlansAct />
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
