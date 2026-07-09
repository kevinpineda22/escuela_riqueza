import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { Pencil, Undo2 } from "lucide-react";
import { useAdminStore, useIsCurrentUserAdmin } from "@/stores/admin.store";
import { cn } from "@/lib/utils";

type EditableFieldProps = {
  textKey: string;
  defaultValue: string;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  after?: ReactNode;
  before?: ReactNode;
};

const EditableField = ({
  textKey,
  defaultValue,
  as: Tag = "span",
  className = "",
  multiline = false,
  after,
  before,
}: EditableFieldProps) => {
  const isAdmin = useIsCurrentUserAdmin();
  const isEditMode = useAdminStore((s) => s.isEditMode);
  const ensureLoaded = useAdminStore((s) => s.ensureLoaded);
  const stageChange = useAdminStore((s) => s.stageChange);
  const discardChange = useAdminStore((s) => s.discardChange);
  // Valor a mostrar: edición en buffer > valor en base > default.
  const value = useAdminStore(
    (s) => s.pending[textKey] ?? s.values[textKey] ?? defaultValue,
  );
  // Valor confirmado (base o default) — baseline para detectar si un cambio
  // volvió al original y para el botón de deshacer.
  const confirmedValue = useAdminStore((s) => s.values[textKey] ?? defaultValue);
  const isPending = useAdminStore((s) => textKey in s.pending);

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Dispara la carga única de textos (idempotente en el store).
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const showEditableUI = isAdmin && isEditMode;
  const editing = isEditing && showEditableUI;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Sólo guarda en el buffer local. NADA se escribe en la base hasta "Guardar".
    // Pasa el baseline para que volver al original limpie el pendiente.
    stageChange(textKey, e.target.value, confirmedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      discardChange(textKey); // revierte al valor confirmado
      setIsEditing(false);
    }
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      setIsEditing(false); // cierra el input; el cambio queda en buffer
    }
  };

  // Modo edición: input/textarea legible.
  // Reseteamos por completo la tipografía heredada del contexto (títulos con
  // gradiente usan italic, tracking negativo y peso alto → texto comprimido).
  // Aquí forzamos texto normal, con espaciado y color garantizados.
  if (editing) {
    const editorBase = cn(
      "w-full bg-darker text-white text-base font-normal not-italic normal-case",
      "font-sans leading-relaxed tracking-normal [letter-spacing:normal] [word-spacing:normal]",
      "[-webkit-text-fill-color:#fff] caret-[color:#CCA43B]",
      "border-2 border-gold rounded-lg shadow-lg",
      "focus:outline-none focus:ring-2 focus:ring-gold/50",
    );
    return (
      <span
        className="relative inline-block w-full max-w-full min-w-[10ch] align-baseline not-italic"
        // Si el campo vive dentro de un <Link>, evita que interactuar con el
        // input dispare la navegación del anchor.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={handleChange}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleKeyDown}
            autoFocus
            rows={3}
            className={cn(editorBase, "px-3 py-2 resize-y min-h-[72px]")}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={handleChange}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleKeyDown}
            autoFocus
            className={cn(editorBase, "px-3 py-2")}
          />
        )}
      </span>
    );
  }

  // Modo visualización. Contorno punteado permanente mientras se edita → deja
  // claro qué es clicleable (patrón Notion/Webflow). Se intensifica al hover.
  // Pendiente = ámbar con tinte de fondo; guardado = dorado tenue.
  const editableClasses = showEditableUI
    ? cn(
        "group cursor-pointer rounded-[3px] outline-dashed outline-1 outline-offset-2 transition-colors",
        isPending
          ? "outline-amber-400/70 bg-amber-400/5"
          : "outline-gold/30 hover:outline-gold/70 hover:bg-gold/5",
      )
    : "";

  return (
    <Tag
      className={cn(className, editableClasses, "whitespace-pre-wrap")}
      onClick={(e) => {
        if (showEditableUI) {
          e.preventDefault(); // no navegar si está dentro de un <Link>
          setIsEditing(true);
        }
      }}
      title={showEditableUI ? (isPending ? "Editado (sin guardar) — clic para editar" : "Clic para editar") : undefined}
    >
      {before}
      {value || (showEditableUI ? " — " : "")}
      {after}
      {showEditableUI && (
        <Pencil
          size={14}
          className={cn(
            "inline-block ml-1.5 align-middle transition-opacity",
            isPending
              ? "opacity-100 text-amber-400"
              : "opacity-40 group-hover:opacity-100 text-gold",
          )}
        />
      )}
      {showEditableUI && isPending && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault(); // no navegar si está dentro de un <Link>
            e.stopPropagation(); // no abrir el editor
            discardChange(textKey);
          }}
          title="Deshacer este cambio"
          aria-label="Deshacer este cambio"
          className="inline-flex align-middle ml-1 text-amber-400/70 hover:text-amber-300 transition-colors"
        >
          <Undo2 size={13} />
        </button>
      )}
    </Tag>
  );
};

export default EditableField;
