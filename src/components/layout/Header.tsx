import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { Button } from "@/components/ui/button";

const Header = () => {
  const { scrollY } = useScroll();
  
  // Transición de transparente a glassmorphism oscuro
  const backgroundColor = useTransform(
    scrollY,
    [0, 50],
    ["rgba(10, 10, 10, 0)", "rgba(10, 10, 10, 0.8)"]
  );
  
  const backdropFilter = useTransform(
    scrollY,
    [0, 50],
    ["blur(0px)", "blur(12px)"]
  );
  
  const borderColor = useTransform(
    scrollY,
    [0, 50],
    ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.05)"]
  );

  return (
    <motion.header
      style={{
        backgroundColor,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter, // para Safari
        borderColor,
      }}
      className="fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-6 py-3 md:py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
            alt="Logo Escuela de la Riqueza"
            className="h-12 md:h-16 object-contain drop-shadow-md"
          />
        </Link>

        {/* Action / CTA */}
        <div className="flex items-center gap-4">
          <Button asChild variant="primary" size="md" className="rounded-full px-6 md:px-8 text-sm md:text-base">
            <Link to="/login">Ingresar</Link>
          </Button>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
