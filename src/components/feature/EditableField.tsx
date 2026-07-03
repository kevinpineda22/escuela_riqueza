import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { useAdminStore, isCurrentUserAdmin } from "@/stores/admin.store";
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
  const isAdmin = isCurrentUserAdmin();
  const isEditMode = useAdminStore((s) => s.isEditMode);
  const ensureLoaded = useAdminStore((s) => s.ensureLoaded);
  const stageChange = useAdminStore((s) => s.stageChange);
  const discardChange = useAdminStore((s) => s.discardChange);
  // Valor a mostrar: edición en buffer > valor en base > default.
  const value = useAdminStore(
    (s) => s.pending[textKey] ?? s.values[textKey] ?? defaultValue,
  );
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
    stageChange(textKey, e.target.value);
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
      <span className="relative inline-block w-full max-w-full min-w-[10ch] align-baseline not-italic">
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

  // Modo visualización. Realce sutil con box-shadow (no rompe el gradiente).
  // Los campos con edición sin guardar se marcan con un punto ámbar.
  const editableClasses = showEditableUI
    ? cn(
        "group cursor-pointer rounded-sm transition-shadow hover:ring-2 hover:ring-gold/40",
        isPending && "ring-2 ring-amber-400/60",
      )
    : "";

  return (
    <Tag
      className={cn(className, editableClasses, "whitespace-pre-wrap")}
      onClick={() => {
        if (showEditableUI) setIsEditing(true);
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
    </Tag>
  );
};

export default EditableField;
