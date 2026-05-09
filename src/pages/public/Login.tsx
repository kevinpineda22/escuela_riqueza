import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Lock, Mail, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { loginSchema, type LoginInput } from "@/schemas/auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { USER_ROLES } from "@/types/user";

const formVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.6, 
      ease: "easeOut",
      staggerChildren: 0.1 
    } 
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (input: LoginInput) => {
    setSubmitError(null);
    try {
      const user = await signIn(input);
      if (user.role === USER_ROLES.ADMIN) {
        navigate("/admin/content");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("No pudimos iniciar sesión. Inténtalo de nuevo.");
      }
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-[#121212] via-[#1a1710] to-[#0a0a0a] flex flex-col justify-center items-center relative overflow-hidden font-sans p-4 sm:p-6 selection:bg-gold/30">
      {/* Grid sutil de fondo (ahora con un poco más de opacidad para que se vea) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      {/* Interactividad del mouse */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0 hidden md:block"
        animate={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(204,164,59,0.08), transparent 80%)`,
        }}
      />

      {/* Orbes flotantes ambientales - más brillantes para mayor contraste */}
      <motion.div
        animate={{ y: [0, -20, 0], scale: [1, 1.05, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[5%] -left-[5%] w-[400px] h-[400px] bg-gold rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, 30, 0], scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-[10%] -right-[5%] w-[500px] h-[500px] bg-amber-500 rounded-full blur-[120px] pointer-events-none"
      />

      <div className="w-full max-w-[400px] relative z-10 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <Link to="/" className="inline-block relative group">
            <div className="absolute inset-0 bg-gold/30 blur-xl rounded-full scale-50 group-hover:scale-110 transition-transform duration-500 opacity-0 group-hover:opacity-100" />
            <img
              src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
              alt="Logo Escuela de la Riqueza"
              className="h-20 md:h-24 mx-auto object-contain drop-shadow-md relative z-10 transition-transform duration-500 group-hover:-translate-y-1"
            />
          </Link>
        </motion.div>

        <motion.form
          variants={formVariants}
          initial="hidden"
          animate="visible"
          onSubmit={handleSubmit(onSubmit)}
          className="w-full bg-white/[0.04] border border-white/[0.1] rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden"
          noValidate
        >
          {/* Borde brillante superior sutil */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

          {submitError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }} 
              className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400 overflow-hidden"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-tight">{submitError}</p>
            </motion.div>
          )}

          <div className="space-y-5">
            <motion.div variants={itemVariants} className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-white/90 ml-1">
                Correo Electrónico
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40 group-focus-within:text-gold transition-colors" size={20} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 focus:bg-black/70 transition-all shadow-inner"
                  placeholder="usuario@tuempresa.com"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 ml-1 font-medium">
                  {errors.email.message}
                </motion.p>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label htmlFor="password" className="text-sm font-semibold text-white/90">
                  Contraseña
                </label>
                <a href="#" className="text-xs text-gold hover:text-goldHover transition-colors font-medium">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40 group-focus-within:text-gold transition-colors" size={20} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 focus:bg-black/70 transition-all shadow-inner"
                  placeholder="••••••••"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 ml-1 font-medium">
                  {errors.password.message}
                </motion.p>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full py-3.5 bg-gold hover:bg-goldHover text-darker font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(204,164,59,0.3)] disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Autenticando...
                  </>
                ) : (
                  <>
                    Ingresar <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>
          </div>
        </motion.form>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-textMuted text-sm mt-6"
        >
          ¿Aún no eres parte?{" "}
          <Link to="/registro" className="text-gold hover:text-goldHover font-semibold transition-colors">
            Crea tu cuenta aquí
          </Link>
        </motion.p>
      </div>
    </div>
  );
};

export default Login;
