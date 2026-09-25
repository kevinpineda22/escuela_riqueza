import { useNavigate } from "react-router-dom";
import { Video } from "lucide-react";

interface LiveReplayPaywallProps {
  title: string;
  loggedIn: boolean;
  loginPath: string;
}

/**
 * En lugar de la repetición, para quien no la puede ver: el en vivo público es
 * abierto, la grabación es de los planes Individual/VIP (`canWatchReplay`),
 * salvo que la sala la haya abierto a todos (`replay_is_public`).
 */
export function LiveReplayPaywall({ title, loggedIn, loginPath }: LiveReplayPaywallProps) {
  const navigate = useNavigate();

  return (
    <div className="text-center p-8 z-10 max-w-md">
      <Video size={64} className="mx-auto text-brand/60 mb-6" />
      <p className="text-xs uppercase tracking-widest text-foreground-muted font-bold mb-2 truncate">{title}</p>
      <h2 className="text-2xl font-bold text-foreground-strong mb-2">La repetición es para alumnos</h2>
      <p className="text-foreground-muted mb-8">
        Este en vivo estuvo abierto para todos. La grabación completa de la clase queda disponible para alumnos con plan Individual o VIP.
      </p>
      {!loggedIn ? (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => navigate(loginPath)}
            className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
          >
            Inicia sesión
          </button>
          <button
            onClick={() => navigate("/planes")}
            className="text-sm text-foreground-muted hover:text-accent underline underline-offset-4 transition-colors"
          >
            Ver planes
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate("/planes")}
          className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
        >
          Ver planes
        </button>
      )}
    </div>
  );
}
