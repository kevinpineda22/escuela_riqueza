import { Shield } from "lucide-react";
import type { CommunityAuthor } from "@/lib/api/community";
import { authorInitials } from "./community-utils";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "h-8 w-8 text-xs ring-1", badge: "h-4 w-4 -bottom-0.5 -right-0.5", icon: 8 },
  md: { box: "h-10 w-10 text-xs ring-1", badge: "h-4 w-4 -bottom-0.5 -right-0.5", icon: 8 },
  lg: { box: "h-12 w-12 text-base ring-2", badge: "h-5 w-5 -bottom-1 -right-1", icon: 10 },
  xl: { box: "h-14 w-14 text-lg ring-2", badge: "h-5 w-5 -bottom-1 -right-1", icon: 10 },
} as const;

interface AuthorAvatarProps {
  author: CommunityAuthor | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Avatar de autor de la comunidad (tarjeta, detalle y comentarios). Antes había
 * tres copias con un degradé blanco y el aro del escudo admin en `ring-darker`
 * (#0a0a0a fijo): en claro quedaban un círculo gris lavado y un aro negro.
 * El aro del escudo toma el color de la superficie de la tarjeta en cada tema.
 */
export function AuthorAvatar({ author, size = "md", className }: AuthorAvatarProps) {
  const isAdmin = author?.role === "admin";
  const s = SIZES[size];
  return (
    // `self-start`: en una fila flex el contenedor se estiraba a toda la
    // altura de la tarjeta y el escudo admin quedaba abajo, junto al Me gusta.
    <div className={cn("relative shrink-0 self-start", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full font-bold transition-all",
          s.box,
          isAdmin
            ? "bg-gradient-to-br from-brand/30 to-brand/10 text-accent ring-focus/50"
            : "bg-gradient-to-br from-ink/15 to-ink/5 text-fg-90 ring-ink/15 light:from-surface-subtle light:to-surface-panel"
        )}
      >
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{authorInitials(author)}</span>
        )}
      </div>
      {isAdmin && (
        <div
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-brand ring-2 ring-surface-page light:ring-surface-panel",
            s.badge
          )}
        >
          <Shield size={s.icon} className="text-on-brand" strokeWidth={3} aria-hidden />
        </div>
      )}
    </div>
  );
}
