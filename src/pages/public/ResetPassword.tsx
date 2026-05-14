import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  AlertCircle,
} from "lucide-react";
import { motion } from "motion/react";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/schemas/auth.schema";
import { updatePassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { supabase } from "@/lib/supabase";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(
    null
  );

  // Supabase deja una sesión "recovery" en la URL al volver del email.
  // detectSessionInUrl viene activado por defecto, así que solo escuchamos
  // el evento PASSWORD_RECOVERY y nos quedamos con la sesión actual.
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasRecoverySession(Boolean(data.session));
    };
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    setSubmitError(null);
    try {
      await updatePassword(password);
      setSuccess(true);
      // Cerramos la sesión recovery para forzar login limpio con la nueva pass.
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 2200);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("No pudimos actualizar tu contraseña. Inténtalo de nuevo.");
      }
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-[#121212] via-[#1a1710] to-[#0a0a0a] flex flex-col justify-center items-center relative overflow-hidden font-sans p-4 sm:p-6 selection:bg-gold/30">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"
      />
      <div
        aria-hidden
        className="hidden md:block absolute -bottom-[10%] -right-[5%] w-[500px] h-[500px] bg-amber-500 rounded-full blur-[120px] opacity-15 pointer-events-none"
      />

      <div className="w-full max-w-[440px] relative z-10 flex flex-col items-center">
        <div className="w-full bg-white/[0.04] border border-white/[0.1] rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Crear nueva contraseña
          </h1>
          <p className="text-sm text-textMuted mb-6">
            Elige una contraseña segura de al menos 8 caracteres.
          </p>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center gap-3 py-4"
            >
              <CheckCircle2 className="text-gold" size={40} />
              <p className="text-white font-semibold">¡Contraseña actualizada!</p>
              <p className="text-sm text-textMuted">
                Te llevamos al inicio de sesión...
              </p>
            </motion.div>
          ) : hasRecoverySession === false ? (
            <div className="space-y-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-tight">
                  Este enlace expiró o ya fue utilizado. Solicita uno nuevo desde la
                  pantalla de inicio de sesión.
                </p>
              </div>
              <Link
                to="/recuperar-contrasena"
                className="block w-full text-center py-3 bg-gold hover:bg-goldHover text-darker font-bold rounded-2xl transition-all"
              >
                Solicitar un enlace nuevo
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-5"
            >
              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium leading-tight">
                    {submitError}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-white/90 ml-1"
                >
                  Nueva contraseña
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-gold transition-colors"
                    size={20}
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 focus:bg-black/70 transition-all shadow-inner"
                    placeholder="••••••••"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 ml-1 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-semibold text-white/90 ml-1"
                >
                  Repite la contraseña
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-gold transition-colors"
                    size={20}
                  />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 focus:bg-black/70 transition-all shadow-inner"
                    placeholder="••••••••"
                    {...register("confirmPassword")}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400 ml-1 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || hasRecoverySession === null}
                className="w-full py-3.5 bg-gold hover:bg-goldHover text-darker font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(204,164,59,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    Guardar contraseña <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
