import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Crown
} from "lucide-react";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  type LoginInput,
  type SignupInput,
  type ForgotPasswordInput,
} from "@/schemas/auth.schema";
import { useAuth } from "@/hooks/useAuth";
import ParticleNetwork from "@/components/feature/ParticleNetwork";
import { requestPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { USER_ROLES } from "@/types/user";
import { cn } from "@/lib/utils";
import { usePlatformSettings, formatPrice } from "@/hooks/usePlatformSettings";

const LOGO_LIGHT_FALLBACK =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

type Mode = "signin" | "signup" | "forgot";

interface AuthPageProps {
  initialMode?: Mode;
}

/* ============================================================ */
/* Field reutilizable                                            */
/* ============================================================ */

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  icon: React.ReactNode;
  error?: string;
  rightSlot?: React.ReactNode;
  registration: UseFormRegisterReturn;
}

const Field = ({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  icon,
  error,
  rightSlot,
  registration,
}: FieldProps) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-xs font-semibold text-white/80 ml-1">
      {label}
    </label>
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-gold transition-colors pointer-events-none">
        {icon}
      </div>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn(
          "w-full bg-black/40 border border-white/10 rounded-xl pl-11 py-2.5 text-sm text-white placeholder:text-white/30",
          "focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/20 focus:bg-black/60 transition-all",
          rightSlot ? "pr-11" : "pr-4"
        )}
        {...registration}
      />
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightSlot}
        </div>
      )}
    </div>
    {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
  </div>
);

/* ============================================================ */
/* SignIn Form                                                   */
/* ============================================================ */

interface SignInFormProps {
  onSuccess: (toAdmin: boolean) => void;
  onSwitch: () => void;
  onForgot: () => void;
  compact?: boolean;
}

const SignInForm = ({ onSuccess, onSwitch, onForgot, compact = false }: SignInFormProps) => {
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      onSuccess(user.role === USER_ROLES.ADMIN);
    } catch (err) {
      if (err instanceof ApiError) setSubmitError(err.message);
      else setSubmitError("No pudimos iniciar sesión. Inténtalo de nuevo.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center">
        <h2 className="text-2xl md:text-[26px] font-extrabold text-white tracking-tight">
          Iniciar sesión
        </h2>
        <div className="w-10 h-1 bg-gold rounded-full mx-auto mt-2" />
      </div>

      {submitError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-tight">{submitError}</p>
        </div>
      )}

      <Field
        id="signin-email"
        label="Correo"
        type="email"
        autoComplete="email"
        placeholder="usuario@correo.com"
        icon={<Mail size={18} />}
        error={errors.email?.message}
        registration={register("email")}
      />

      <div>
        <Field
          id="signin-password"
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          icon={<Lock size={18} />}
          error={errors.password?.message}
          registration={register("password")}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-white/40 hover:text-white transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        <div className="text-right mt-1.5">
          <button
            type="button"
            onClick={onForgot}
            className="text-xs text-gold hover:text-goldHover transition-colors font-medium"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full py-3 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.8)] disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Autenticando...
          </>
        ) : (
          <>
            Ingresar <ArrowRight size={18} />
          </>
        )}
      </button>

      {compact && (
        <p className="text-center text-sm text-textMuted font-normal">
          ¿No tienes una cuenta?{" "}
          <button
            type="button"
            onClick={onSwitch}
            className="text-gold hover:text-goldHover font-bold transition-colors"
          >
            Crear cuenta
          </button>
        </p>
      )}
    </form>
  );
};

/* ============================================================ */
/* SignUp Form                                                   */
/* ============================================================ */

interface SignUpFormProps {
  onSuccess: () => void;
  onSwitch: () => void;
  compact?: boolean;
}

type SignupStep = "form" | "plans" | "payment";

const SignUpForm = ({ onSuccess, onSwitch, compact = false }: SignUpFormProps) => {
  const { signUp } = useAuth();
  const [step, setStep] = useState<SignupStep>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [savedInput, setSavedInput] = useState<SignupInput | null>(null);
  
  // Extraer el plan inicial de la URL si existe
  const searchParams = new URLSearchParams(window.location.search);
  const initialPlan = searchParams.get("plan") as "free" | "individual" | "vip" || "free";
  const [selectedPlan, setSelectedPlan] = useState<"free" | "individual" | "vip">(initialPlan);
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: platformSettings } = usePlatformSettings();
  const currency = platformSettings?.currency ?? "USD";
  const individualPrice = platformSettings?.price_individual_monthly ?? 19;
  const vipPrice = platformSettings?.price_vip_monthly ?? 99;
  const allowSignups = platformSettings?.allow_signups ?? true;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onFormSubmit = async (input: SignupInput) => {
    setSubmitError(null);
    setSavedInput(input);
    setStep("plans");
  };

  const handlePlanSelect = (plan: "free" | "individual" | "vip") => {
    setSelectedPlan(plan);
    if (plan === "free") {
      executeSignup(plan);
    } else {
      setStep("payment");
    }
  };

  const executeSignup = async (planToUse: string) => {
    if (!savedInput) return;
    setIsProcessing(true);
    setSubmitError(null);
    setSuccessMsg(null);

    try {
      await signUp(savedInput, planToUse);
      setSuccessMsg("¡Cuenta creada! Te redirigimos...");
      setTimeout(onSuccess, 1200);
    } catch (err) {
      setIsProcessing(false);
      setStep("form"); // Vuelve al form si falla
      if (err instanceof ApiError) {
        if (err.message.includes("Revisa tu correo")) {
          setSuccessMsg(err.message);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError("No pudimos crear tu cuenta. Inténtalo de nuevo.");
      }
    }
  };

  if (step === "payment") {
    return (
      <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <button onClick={() => setStep("plans")} className="text-white/40 hover:text-white flex items-center gap-2 text-sm w-fit transition-colors">
          <ArrowLeft size={16} /> Volver a planes
        </button>
        <div className="text-center mb-2">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Simular Pago</h2>
          <p className="text-xs text-textMuted mt-1">Has seleccionado el plan {selectedPlan.toUpperCase()}</p>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-2">
          <div className="flex items-center gap-3 mb-4 text-white/50">
            <CreditCard size={24} />
            <span className="text-sm font-semibold">Pasarela de pago segura (MOCK)</span>
          </div>
          <p className="text-sm text-center text-textMuted mb-4">
            Esto simula el proceso de Stripe. Al hacer clic, se creará tu cuenta con el plan <strong className="text-white">{selectedPlan}</strong> activo.
          </p>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => executeSignup(selectedPlan)}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isProcessing ? <><Loader2 size={18} className="animate-spin" /> Procesando...</> : "Simular Pago Exitoso"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "plans") {
    return (
      <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <button onClick={() => setStep("form")} className="text-white/40 hover:text-white flex items-center gap-2 text-sm w-fit transition-colors">
          <ArrowLeft size={16} /> Volver al formulario
        </button>
        <div className="text-center mb-2">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Elige tu Plan</h2>
          <div className="w-10 h-1 bg-gold rounded-full mx-auto mt-2" />
        </div>

        {isProcessing && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
            <Loader2 className="animate-spin text-gold mb-4" size={32} />
            <p className="text-white font-semibold">Configurando tu cuenta...</p>
          </div>
        )}

        <div className="space-y-3">
          {/* FREE */}
          <button onClick={() => handlePlanSelect("free")} className="w-full text-left bg-black/40 border border-white/10 hover:border-white/30 rounded-xl p-4 transition-all group">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white group-hover:text-gold transition-colors">Free</h3>
              <span className="text-sm font-semibold text-white/50">{formatPrice(0, currency)}</span>
            </div>
            <p className="text-xs text-textMuted mt-1">Con publicidad y funciones limitadas.</p>
          </button>

          {/* INDIVIDUAL */}
          <button onClick={() => handlePlanSelect("individual")} className="w-full text-left bg-blue-500/10 border border-blue-500/30 hover:border-blue-400/50 rounded-xl p-4 transition-all group relative overflow-hidden">
            <div className="flex justify-between items-center relative z-10">
              <h3 className="font-bold text-blue-400 group-hover:text-blue-300 transition-colors">Individual</h3>
              <span className="text-sm font-bold text-blue-400">{formatPrice(individualPrice, currency)}<span className="text-xs opacity-50">/mes</span></span>
            </div>
            <p className="text-xs text-blue-200/60 mt-1 relative z-10">Catálogo sin interrupciones y notas.</p>
          </button>

          {/* VIP */}
          <button onClick={() => handlePlanSelect("vip")} className="w-full text-left bg-gold/10 border border-gold/40 hover:border-gold/60 rounded-xl p-4 transition-all group relative overflow-hidden shadow-[0_0_15px_rgba(204,164,59,0.1)] hover:shadow-[0_0_20px_rgba(204,164,59,0.2)]">
            <div className="absolute top-0 right-0 bg-gold text-darker text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg">Recomendado</div>
            <div className="flex justify-between items-center relative z-10">
              <h3 className="font-bold text-gold group-hover:text-goldHover transition-colors flex items-center gap-1"><Crown size={14}/> VIP</h3>
              <span className="text-sm font-bold text-gold">{formatPrice(vipPrice, currency)}<span className="text-xs opacity-50">/mes</span></span>
            </div>
            <p className="text-xs text-gold/60 mt-1 relative z-10">Acceso total, lives y mentoría grupal.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      className="w-full flex flex-col gap-3.5 animate-in fade-in duration-300"
    >
      <div className="text-center">
        <h2 className="text-2xl md:text-[26px] font-extrabold text-white tracking-tight">
          Crear cuenta
        </h2>
        <div className="w-10 h-1 bg-gold rounded-full mx-auto mt-2" />
      </div>

      {!allowSignups && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-amber-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-tight">
            Los registros nuevos están temporalmente pausados. Volvé a intentarlo en un rato.
          </p>
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-tight">{submitError}</p>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-2 text-green-400">
          <Sparkles size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-tight">{successMsg}</p>
        </div>
      )}

      <Field
        id="signup-name"
        label="Nombre completo"
        type="text"
        autoComplete="name"
        placeholder="Ej. Juan Pérez"
        icon={<UserIcon size={18} />}
        error={errors.fullName?.message}
        registration={register("fullName")}
      />

      <Field
        id="signup-email"
        label="Correo"
        type="email"
        autoComplete="email"
        placeholder="usuario@correo.com"
        icon={<Mail size={18} />}
        error={errors.email?.message}
        registration={register("email")}
      />

      <Field
        id="signup-password"
        label="Contraseña"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        placeholder="••••••••"
        icon={<Lock size={18} />}
        error={errors.password?.message}
        registration={register("password")}
        rightSlot={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-white/40 hover:text-white transition-colors"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <Field
        id="signup-confirm"
        label="Repetir contraseña"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        placeholder="••••••••"
        icon={<Lock size={18} />}
        error={errors.confirmPassword?.message}
        registration={register("confirmPassword")}
      />

      <button
        type="submit"
        disabled={!allowSignups}
        className="mt-1 w-full py-3 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.8)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gold"
      >
        Continuar <ArrowRight size={18} />
      </button>

      {compact && (
        <p className="text-center text-sm text-textMuted font-normal">
          ¿Ya tienes una cuenta?{" "}
          <button
            type="button"
            onClick={onSwitch}
            className="text-gold hover:text-goldHover font-bold transition-colors"
          >
            Iniciar sesión
          </button>
        </p>
      )}
    </form>
  );
};

/* ============================================================ */
/* Forgot Password Form                                          */
/* ============================================================ */

interface ForgotFormProps {
  onBack: () => void;
}

const ForgotForm = ({ onBack }: ForgotFormProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    setSubmitError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      if (err instanceof ApiError) setSubmitError(err.message);
      else setSubmitError("No pudimos enviar el correo. Inténtalo de nuevo.");
    }
  };

  if (sentTo) {
    return (
      <div className="w-full flex flex-col items-center text-center gap-4 py-2">
        <CheckCircle2 className="text-gold" size={44} />
        <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
          Revisa tu correo
        </h2>
        <p className="text-sm text-textMuted leading-relaxed max-w-[280px]">
          Si <span className="text-white font-semibold">{sentTo}</span> está
          registrado, te llegará un enlace para restablecer tu contraseña en los
          próximos minutos. Revisa también la carpeta de spam.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-goldHover transition-colors"
        >
          <ArrowLeft size={14} /> Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center">
        <h2 className="text-2xl md:text-[26px] font-extrabold text-white tracking-tight">
          Recuperar contraseña
        </h2>
        <div className="w-10 h-1 bg-gold rounded-full mx-auto mt-2" />
        <p className="text-xs text-textMuted mt-3 max-w-[260px] mx-auto leading-relaxed">
          Ingresa tu correo y te enviaremos un enlace para crear una nueva.
        </p>
      </div>

      {submitError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-tight">{submitError}</p>
        </div>
      )}

      <Field
        id="forgot-email"
        label="Correo"
        type="email"
        autoComplete="email"
        placeholder="usuario@correo.com"
        icon={<Mail size={18} />}
        error={errors.email?.message}
        registration={register("email")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full py-3 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.8)] disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Enviando...
          </>
        ) : (
          <>
            Enviar enlace <ArrowRight size={18} />
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="text-center text-sm text-textMuted hover:text-gold transition-colors font-medium inline-flex items-center justify-center gap-1.5"
      >
        <ArrowLeft size={14} /> Volver al inicio de sesión
      </button>
    </form>
  );
};

/* ============================================================ */
/* Welcome panels (contenido del overlay dorado)                 */
/* ============================================================ */

interface WelcomePanelProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHelper: string;
  onCta: () => void;
  logoSrc: string;
  platformName: string;
}

const WelcomePanel = ({
  title,
  body,
  ctaLabel,
  ctaHelper,
  onCta,
  logoSrc,
  platformName,
}: WelcomePanelProps) => (
  <div className="h-full w-full px-8 py-10 flex flex-col items-center justify-center text-center gap-5 text-[#120e05]">
    {/* Medallón oscuro: el logo dorado sobre fondo negro, con glow — resuelve el
        contraste oro-sobre-oro y le da profundidad al panel. */}
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 rounded-[2rem] bg-[#0a0a0a]/30 blur-2xl"
      />
      <div className="relative flex items-center justify-center rounded-[1.75rem] bg-gradient-to-b from-[#151515] to-[#0a0a0a] border border-white/10 px-9 py-7 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <img
          src={logoSrc}
          alt={platformName}
          className="h-24 xl:h-28 w-auto object-contain drop-shadow-[0_0_22px_rgba(204,164,59,0.4)]"
        />
      </div>
    </div>
    <h3 className="text-3xl xl:text-[34px] font-extrabold uppercase tracking-tight leading-[1.1] max-w-[280px]">
      {title}
    </h3>
    <p className="text-sm leading-relaxed font-medium opacity-80 max-w-[260px]">
      {body}
    </p>
    <div className="mt-2 flex flex-col items-center gap-2">
      <span className="text-xs font-semibold opacity-60 uppercase tracking-wider">
        {ctaHelper}
      </span>
      <button
        onClick={onCta}
        className="mt-1 px-10 py-2.5 border-2 border-[#120e05] hover:bg-[#120e05]/5 text-[#120e05] font-bold rounded-full transition-all flex items-center gap-2"
      >
        {ctaLabel} <ArrowRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  </div>
);

/* ============================================================ */
/* Fondo: constelación dorada (canvas) + profundidad             */
/* ============================================================ */

const NOISE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

/**
 * Jerarquía clara, sin ruido de capas: base profunda → dos halos que dan color
 * → constelación (el protagonista) → viñeta que centra la mirada en la card →
 * grano sutil. Cada capa tiene UNA función.
 */
const AuthBackground = () => (
  <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Base: negro profundo con un cálido dorado naciendo arriba. */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_50%_-10%,#1c150c_0%,#0a0a0a_48%,#050505_100%)]" />

    {/* Dos halos: uno vivo (arriba-izq), uno profundo (abajo-der). Dan color y
        contraste sin lavar la escena. Fijos: el movimiento lo pone la constelación. */}
    <div className="absolute -top-[18%] -left-[12%] w-[60vw] h-[60vw] max-w-[620px] max-h-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.22),transparent_66%)] blur-[80px]" />
    <div className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vw] max-w-[560px] max-h-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(160,110,30,0.16),transparent_68%)] blur-[100px]" />

    {/* La constelación dorada — protagonista del fondo. */}
    <ParticleNetwork />

    {/* Viñeta radial: oscurece los bordes para que la mirada caiga en el centro. */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_75%_at_50%_50%,transparent_35%,rgba(5,5,5,0.55)_100%)]" />

    {/* Grano sutil: mata el banding de los gradientes y da textura premium. */}
    <div
      className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: `url("${NOISE_SVG}")`, backgroundSize: "200px 200px" }}
    />
  </div>
);

/* ============================================================ */
/* Página principal                                              */
/* ============================================================ */

const isSafeReturnPath = (path: string): boolean => {
  // Solo permitir paths internos (deben empezar con "/" pero no "//" ni "/\")
  return /^\/[^/\\]/.test(path);
};

const AuthPage = ({ initialMode = "signin" }: AuthPageProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const { data: platformSettings } = usePlatformSettings();
  const logoLight = platformSettings?.logo_url || LOGO_LIGHT_FALLBACK;
  const platformName = platformSettings?.platform_name || "Escuela de la Riqueza";

  // Revisar si viene ?plan=vip en la URL
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam && mode !== "signup") {
      setMode("signup");
    }
  }, []);

  const isSignUp = mode === "signup";
  const isForgot = mode === "forgot";
  const overlayOnLeft = isSignUp; // signin y forgot mantienen overlay a la derecha

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const switchTo = (next: Mode) => {
    if (next !== mode) setMode(next);
  };

  const resolveReturnTarget = (toAdmin: boolean): string => {
    const returnToRaw = searchParams.get("returnTo");
    if (returnToRaw) {
      const decoded = decodeURIComponent(returnToRaw);
      if (isSafeReturnPath(decoded)) return decoded;
    }
    return toAdmin ? "/admin/content" : "/dashboard";
  };

  const handleSigninSuccess = (toAdmin: boolean) =>
    navigate(resolveReturnTarget(toAdmin));
  const handleSignupSuccess = () => navigate(resolveReturnTarget(false));

  const slideTransition = {
    type: "tween" as const,
    duration: 0.7,
    ease: [0.83, 0, 0.17, 1] as [number, number, number, number],
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#050505] flex flex-col justify-center items-center relative overflow-hidden font-sans p-4 sm:p-6 selection:bg-gold/30">
      <AuthBackground />

      {/* ==== Volver al inicio (estilo gold pill, coherente con header) ==== */}
      <Link
        to="/"
        className="absolute top-3 left-3 sm:top-6 sm:left-6 z-30 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-darker bg-gold/95 hover:bg-goldHover px-3 sm:px-4 py-2 rounded-full transition-all shadow-[0_4px_18px_-4px_rgba(204,164,59,0.6)] hover:shadow-[0_6px_22px_-4px_rgba(204,164,59,0.8)] hover:-translate-y-0.5"
        aria-label="Volver al inicio"
      >
        <ArrowLeft size={14} />
        <span className="hidden sm:inline">Volver al inicio</span>
      </Link>

      {/* ==== DESKTOP CARD (lg+) ==== */}
      <div className="hidden lg:block relative z-10">
        {/* Signature: border-beam — una luz dorada recorre el borde de la tarjeta.
            La caja NO rota (eso hacía asomar las esquinas): rota un cuadrado de
            conic-gradient más grande que la diagonal de la card, recortado por el
            overflow-hidden del marco a la silueta redondeada. El <article> opaco
            tapa el centro y deja ver solo el ring del borde. */}
        <div className="relative rounded-3xl p-[1.5px] overflow-hidden">
          {/* Borde base tenue: mantiene el ring visible entre pasadas del haz. */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-3xl bg-white/10 pointer-events-none"
          />
          {/* Haz giratorio (cuadrado > diagonal ≈ 1030px, centrado). */}
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 aspect-square w-[1200px] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(204,164,59,0.9)_30deg,transparent_90deg)] pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
      <article
        className="relative w-[860px] h-[560px] rounded-[22px] overflow-hidden bg-darker/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        {/* Brillo de borde superior */}
        <div
          aria-hidden
          className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent pointer-events-none"
        />

        {/* Forms — mitad izquierda (signin/forgot con crossfade), mitad derecha (signup) */}
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative flex items-center justify-center px-12 py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={isForgot ? "forgot" : "signin"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-[300px]"
              >
                {isForgot ? (
                  <ForgotForm onBack={() => switchTo("signin")} />
                ) : (
                  <SignInForm
                    onSuccess={handleSigninSuccess}
                    onSwitch={() => switchTo("signup")}
                    onForgot={() => switchTo("forgot")}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-center px-12 py-10">
            <div className="w-full max-w-[300px]">
              <SignUpForm
                onSuccess={handleSignupSuccess}
                onSwitch={() => switchTo("signin")}
              />
            </div>
          </div>
        </div>

        {/* Overlay dorado deslizante — cubre la mitad correspondiente */}
        <motion.div
          className="absolute top-0 left-0 h-full w-1/2 z-20 overflow-hidden"
          initial={false}
          animate={{ x: overlayOnLeft ? "0%" : "100%" }}
          transition={slideTransition}
        >
          <div className="relative h-full w-full bg-gradient-to-br from-[#F0C959] via-gold to-[#7d5e18] overflow-hidden">
            {/* Brillo lineal súper suave arriba */}
            <div
              aria-hidden
              className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-white/15 to-transparent pointer-events-none"
            />
            {/* Sombras en bordes para enmarcar */}
            <div
              aria-hidden
              className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.1)] pointer-events-none"
            />
            {/* Ruido elegante */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
              style={{ backgroundImage: `url("${NOISE_SVG}")`, backgroundSize: "150px 150px" }}
            />

            {/* Contenido dentro del overlay con crossfade */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="relative h-full w-full"
              >
                {isSignUp ? (
                  <WelcomePanel
                    title="Hola, futuro gigante"
                    body="Únete hoy y comienza tu transformación. Sin atajos, con resultados reales."
                    ctaLabel="Iniciar sesión"
                    ctaHelper="¿Ya tienes cuenta?"
                    onCta={() => switchTo("signin")}
                    logoSrc={logoLight}
                    platformName={platformName}
                  />
                ) : (
                  <WelcomePanel
                    title="Bienvenido de vuelta"
                    body="Continúa tu camino. Tu rediseño cerebral sigue avanzando — vuelve justo a donde lo dejaste."
                    ctaLabel="Crear cuenta"
                    ctaHelper="¿Aún no tienes cuenta?"
                    onCta={() => switchTo("signup")}
                    logoSrc={logoLight}
                    platformName={platformName}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </article>
        </div>
      </div>

      {/* ==== MOBILE / TABLET (< lg) ==== */}
      <div className="lg:hidden w-full max-w-md relative z-10 mt-16 sm:mt-14">
        <Link
          to="/"
          className="flex justify-center mb-6"
          aria-label="Inicio"
        >
          <img
            src={logoLight}
            alt={platformName}
            className="h-20 sm:h-24 w-auto object-contain drop-shadow-[0_0_22px_rgba(204,164,59,0.4)]"
          />
        </Link>

        {/* Tabs solo visibles cuando NO estás en modo forgot */}
        {!isForgot && (
          <div className="grid grid-cols-2 bg-white/[0.04] border border-white/10 rounded-2xl p-1 mb-5 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => switchTo("signin")}
              className={cn(
                "py-2.5 rounded-xl text-sm font-bold transition-all",
                !isSignUp
                  ? "bg-gold text-darker shadow-[0_4px_18px_-6px_rgba(204,164,59,0.6)]"
                  : "text-white/70 hover:text-white"
              )}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => switchTo("signup")}
              className={cn(
                "py-2.5 rounded-xl text-sm font-bold transition-all",
                isSignUp
                  ? "bg-gold text-darker shadow-[0_4px_18px_-6px_rgba(204,164,59,0.6)]"
                  : "text-white/70 hover:text-white"
              )}
            >
              Crear cuenta
            </button>
          </div>
        )}

        <div className="bg-white/[0.04] border border-gold/15 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8),0_0_44px_-12px_rgba(204,164,59,0.28)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: isSignUp ? 24 : -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? -24 : 24 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {isForgot ? (
                <ForgotForm onBack={() => switchTo("signin")} />
              ) : isSignUp ? (
                <SignUpForm
                  onSuccess={handleSignupSuccess}
                  onSwitch={() => switchTo("signin")}
                  compact
                />
              ) : (
                <SignInForm
                  onSuccess={handleSigninSuccess}
                  onSwitch={() => switchTo("signup")}
                  onForgot={() => switchTo("forgot")}
                  compact
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
