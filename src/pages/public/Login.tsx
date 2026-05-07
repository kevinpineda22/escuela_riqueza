import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/schemas/auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { USER_ROLES } from "@/types/user";

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
        navigate("/admin/upload");
      } else if (user.plan === "vip") {
        navigate("/vip-live");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("No pudimos iniciar sesión. Probá de nuevo.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-darker flex flex-col justify-center items-center relative overflow-hidden font-sans p-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute m-auto h-[400px] w-[400px] rounded-full bg-gold opacity-10 blur-[120px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link to="/">
            <img
              src="/LOGO-ESCUELA.webp"
              alt="Logo Escuela de la Riqueza"
              className="h-20 mx-auto mb-6 object-contain drop-shadow-md hover:scale-105 transition-transform"
            />
          </Link>
          <h2 className="text-3xl font-bold text-white mb-2">Bienvenido de nuevo</h2>
          <p className="text-textMuted">Ingresa para continuar tu aprendizaje.</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl"
          noValidate
        >
          {submitError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
              <AlertCircle size={20} />
              <p className="text-sm">{submitError}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-textMuted">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  placeholder="usuario@tuempresa.com"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-sm font-medium text-textMuted">
                  Contraseña
                </label>
                <a href="#" className="text-xs text-gold hover:text-goldHover transition-colors">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  placeholder="••••••••"
                  {...register("password")}
                />
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(204,164,59,0.3)] mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Iniciando sesión...
                </>
              ) : (
                <>
                  Iniciar Sesión Premium <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-textMuted text-center mt-6">
            Cuentas de prueba: <span className="text-gold">vip@escuela.com</span>,{" "}
            <span className="text-gold">usuario@premium.com</span>, <span className="text-gold">admin@escuela.com</span>{" "}
            (password <span className="text-gold">admin123</span>)
          </p>
        </form>

        <p className="text-center text-textMuted text-sm mt-8">
          ¿Aún no tienes un plan?{" "}
          <Link to="/#planes" className="text-gold hover:underline">
            Ver Planes
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
