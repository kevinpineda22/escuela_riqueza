import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth.schema";
import { completeRequiredPasswordChange } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth.store";
import { isSafeReturnPath } from "@/lib/safeReturnPath";

const INPUT_CLASS =
  "w-full bg-black/50 border border-line-subtle rounded-2xl pl-12 pr-12 py-3 text-foreground-strong placeholder:text-fg-30 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-focus/50 focus:bg-black/70 light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder light:focus:bg-surface-input light:focus:border-accent transition-all shadow-inner";

/**
 * Primer ingreso con la contraseña temporal del correo de bienvenida (alta
 * masiva de una cohorte). RequireAuth manda acá hasta que la persona crea la
 * suya; después vuelve a donde iba.
 */
const CreatePassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const returnTo = searchParams.get("returnTo");
  const target = returnTo && isSafeReturnPath(returnTo) ? returnTo : "/dashboard";

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    setSubmitError(null);
    try {
      const fresh = await completeRequiredPasswordChange(password);
      // Sin la marca: RequireAuth ya no vuelve a mandar acá.
      if (fresh) setUser(fresh);
      else if (user) setUser({ ...user, mustChangePassword: false });
      navigate(target, { replace: true });
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "No pudimos guardar tu contraseña. Inténtalo de nuevo.",
      );
    }
  };

  const firstName = user?.fullName?.split(" ")[0];

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-[#121212] via-[#1a1710] to-[#0a0a0a] light:from-surface-page light:via-[#f3ead6] light:to-surface-page flex flex-col justify-center items-center relative overflow-hidden font-sans p-4 sm:p-6 selection:bg-brand/30">
      <div className="w-full max-w-[440px] relative z-10">
        <div className="w-full bg-ink/[0.04] border border-ink/[0.1] rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] light:bg-surface-panel light:border-line-subtle light:shadow-panel">
          <div className="flex items-center justify-center size-12 rounded-2xl bg-brand/15 text-accent mb-4">
            <ShieldCheck size={24} aria-hidden />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground-strong mb-2">
            {firstName ? `${firstName}, crea tu contraseña` : "Crea tu contraseña"}
          </h1>
          <p className="text-sm text-foreground-muted mb-6">
            Entraste con una contraseña temporal. Por tu seguridad, elige una propia de al menos
            8 caracteres: es la que usarás desde ahora.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {submitError && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-danger">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-tight">{submitError}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-semibold text-fg-90 ml-1">
                Nueva contraseña
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-40 group-focus-within:text-accent transition-colors" size={20} />
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                  placeholder="••••••••"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-40 hover:text-foreground-strong transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger ml-1 font-medium">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-new-password" className="text-sm font-semibold text-fg-90 ml-1">
                Repite la contraseña
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-40 group-focus-within:text-accent transition-colors" size={20} />
                <input
                  id="confirm-new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                  placeholder="••••••••"
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-danger ml-1 font-medium">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-brand hover:bg-brand-hover text-on-brand font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(204,164,59,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  Guardar y entrar <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { void signOut().then(() => navigate("/login", { replace: true })); }}
            className="mt-5 w-full text-center text-sm text-foreground-muted hover:text-foreground-strong transition-colors"
          >
            No soy {user?.email || "yo"} · Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePassword;
