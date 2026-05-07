import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navLinks = [
  { label: "Historia", href: "#historia" },
  { label: "Módulos", href: "#modulos" },
  { label: "Planes", href: "#planes" },
];

const Header = () => {
  const { scrollY } = useScroll();
  const [isOpen, setIsOpen] = useState(false);
  
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

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 justify-center gap-10">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-base lg:text-lg font-medium text-textMuted hover:text-gold transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <Button asChild variant="primary" size="md" className="rounded-full px-8 text-base">
            <Link to="/login">Ingresar</Link>
          </Button>
        </div>

        {/* Mobile Navigation (Sheet) */}
        <div className="md:hidden flex items-center">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white" aria-label="Abrir menú">
                <Menu size={28} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-darker/95 backdrop-blur-xl border-white/10 pt-16">
              <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
              <SheetDescription className="sr-only">
                Enlaces a las secciones principales de la página y acceso a la plataforma.
              </SheetDescription>
              <nav className="flex flex-col gap-6 items-center">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-xl font-medium text-white hover:text-gold transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="w-full h-px bg-white/10 my-4" />
                <Button asChild variant="primary" size="lg" className="w-full rounded-full text-lg" onClick={() => setIsOpen(false)}>
                  <Link to="/login">Ingresar</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
