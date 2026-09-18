import { useThemedLogo } from "@/hooks/useThemedLogo";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  src: string;
  alt: string;
  /** Clases del <img> (alto, sombra, hover). */
  className?: string;
  /** Clases de la placa de respaldo (p. ej. padding según el tamaño del logo). */
  plateClassName?: string;
}

// En claro, el logo oficial cambia a su variante de lettering negro. Un logo
// personalizado (Ajustes) no tiene variante: va sobre una placa oscura compacta
// (spec §3.4). Nunca filtros invert/brightness para recolorear la marca.
const BrandLogo = ({ src, alt, className, plateClassName }: BrandLogoProps) => {
  const logo = useThemedLogo(src);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center",
        logo.needsPlate && [
          "light:rounded-2xl light:bg-darker light:px-3 light:py-1.5 light:shadow-panel light:ring-1 light:ring-brand/25",
          plateClassName,
        ]
      )}
    >
      <img
        src={logo.src}
        alt={alt}
        // El glow dorado realza el lettering blanco; alrededor del negro ensucia.
        className={cn(className, !logo.needsPlate && "light:drop-shadow-none")}
      />
    </span>
  );
};

export default BrandLogo;
