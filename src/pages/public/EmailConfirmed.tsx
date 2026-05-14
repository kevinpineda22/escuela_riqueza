import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, Home } from "lucide-react";
import { supabase } from "@/lib/supabase";

const LOGO_LIGHT =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

type Status = "checking" | "success" | "error";

const EmailConfirmed = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      // Supabase ya procesa el token del hash de la URL automáticamente
      // (detectSessionInUrl está activo por defecto).
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      // Si vino un error explícito en query params
      const errorDescription = searchParams.get("error_description");
      if (errorDescription) {
        setStatus("error");
        setErrorMessage(decodeURIComponent(errorDescription));
        return;
      }

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        setStatus("success");
        return;
      }

      // Sin sesión y sin error claro: probablemente link expirado
      setStatus("error");
      setErrorMessage(
        "El enlace de verificación expiró o ya fue utilizado. Inicia sesión normalmente o solicita uno nuevo."
      );
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  // Auto-redirect tras éxito
  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(() => navigate("/dashboard"), 2200);
    return () => clearTimeout(t);
  }, [status, navigate]);

  return (
    <div className="min-h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden font-sans px-5 sm:px-6 py-12 selection:bg-gold/30">
      {/* Fondo cinemático */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,#1a1410_0%,#0a0a0a_50%,#050505_100%)] pointer-events-none"
      />
      <motion.div
        aria-hidden
        className="hidden md:block absolute -top-1/3 -left-1/4 w-[80vw] h-[80vw] max-w-[900px] max-h-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.3)_0%,rgba(204,164,59,0.04)_45%,transparent_70%)] blur-3xl pointer-events-none"
        animate={{ x: [0, 60, -20, 0], y: [0, -40, 20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        aria-hidden
        className="md:hidden absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[120vw] h-[120vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.18),transparent_60%)] blur-2xl pointer-events-none"
      />

      <motion.div
        className="relative z-10 flex flex-col items-center text-center max-w-lg w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <Link to="/" className="mb-8 sm:mb-10">
          <img
            src={LOGO_LIGHT}
            alt="Escuela de la Riqueza"
            className="h-14 sm:h-16 w-auto object-contain drop-shadow-[0_0_22px_rgba(204,164,59,0.4)]"
          />
        </Link>

        {status === "checking" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full bg-gold/30 blur-2xl scale-150"
              />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-gold/20 to-amber-500/10 border border-gold/30 flex items-center justify-center">
                <Loader2 className="text-gold animate-spin" size={28} strokeWidth={1.8} />
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Verificando tu cuenta...
            </h1>
            <p className="text-sm text-textMuted leading-relaxed max-w-sm">
              Estamos confirmando tu correo electrónico. Solo tardará un momento.
            </p>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-5 w-full"
          >
            <div className="relative">
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-full bg-gold/30 blur-2xl scale-150"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gold/25 to-amber-500/15 border border-gold/40 flex items-center justify-center shadow-[0_0_30px_rgba(204,164,59,0.4)]"
              >
                <CheckCircle2 className="text-gold" size={36} strokeWidth={2} />
              </motion.div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-gold/80">
                Cuenta verificada
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ¡Bienvenido a la Escuela!
              </h1>
              <p className="text-sm text-textMuted leading-relaxed max-w-sm mx-auto">
                Tu cuenta está activa. Te llevamos a tu panel en un momento...
              </p>
            </div>

            <Link
              to="/dashboard"
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm transition-all shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.85)] hover:-translate-y-0.5"
            >
              Ir a mi panel ahora <ArrowRight size={16} />
            </Link>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-5 w-full"
          >
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl scale-150"
              />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500/15 to-red-700/10 border border-red-500/30 flex items-center justify-center">
                <AlertCircle className="text-red-400" size={32} strokeWidth={1.8} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-red-400/80">
                Verificación fallida
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                No pudimos verificar tu cuenta
              </h1>
              <p className="text-sm text-textMuted leading-relaxed max-w-sm mx-auto">
                {errorMessage || "El enlace no es válido o ya expiró."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2 w-full sm:w-auto">
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm transition-all shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:-translate-y-0.5"
              >
                Iniciar sesión <ArrowRight size={16} />
              </Link>
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 hover:text-white font-medium text-sm transition-all"
              >
                <Home size={16} /> Volver al inicio
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default EmailConfirmed;
