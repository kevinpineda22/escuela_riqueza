import {
  Edit2, Trash2, Eye, EyeOff, Plus, PlayCircle, AlertCircle,
  MoreVertical, Film
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import type { Module, Lesson } from "@/lib/api/stream/content";
import { PLAN_BADGE_STYLES, type Plan } from "./PlansSelector";

interface ModuleDetailProps {
  module: Module;
  lessons: Lesson[];
  onEditModule: () => void;
  onTogglePublishModule: () => void;
  onDeleteModule: () => void;
  onCreateLesson: () => void;
  onEditLesson: (lesson: Lesson) => void;
  onTogglePublishLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}

export const ModuleDetail = ({
  module,
  lessons,
  onEditModule,
  onTogglePublishModule,
  onDeleteModule,
  onCreateLesson,
  onEditLesson,
  onTogglePublishLesson,
  onDeleteLesson,
}: ModuleDetailProps) => {
  const publishedCount = lessons.filter((l) => l.is_published).length;
  const withVideoCount = lessons.filter((l) => l.stream_uid).length;

  return (
    <div className="flex-1 flex flex-col bg-darker/40 border border-white/5 rounded-2xl overflow-hidden min-w-0">
      <header className="p-6 border-b border-white/5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                  module.is_published
                    ? "bg-green-500/15 text-green-300 border border-green-500/30"
                    : "bg-white/5 text-white/60 border border-white/10"
                )}
              >
                {module.is_published ? "Publicado" : "Borrador"}
              </span>
              {module.allowed_plans?.map((plan) => (
                <span
                  key={plan}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded capitalize",
                    PLAN_BADGE_STYLES[plan as Plan]
                  )}
                >
                  {plan}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1.5">{module.title}</h1>
            {module.description && (
              <p className="text-sm text-textMuted leading-relaxed line-clamp-2">{module.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onEditModule}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Edit2 size={14} />
              <span className="hidden sm:inline">Editar</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Más acciones del módulo"
                >
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onTogglePublishModule}>
                  {module.is_published ? (
                    <><EyeOff size={14} className="mr-2" /> Ocultar módulo</>
                  ) : (
                    <><Eye size={14} className="mr-2" /> Publicar módulo</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDeleteModule} className="text-red-400 focus:text-red-300">
                  <Trash2 size={14} className="mr-2" /> Eliminar módulo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs text-textMuted">
          <span className="flex items-center gap-1.5">
            <Film size={13} className="text-white/40" />
            <strong className="text-white font-semibold">{lessons.length}</strong> lecciones
          </span>
          <span className="flex items-center gap-1.5">
            <Eye size={13} className="text-white/40" />
            <strong className="text-white font-semibold">{publishedCount}</strong> publicadas
          </span>
          <span className="flex items-center gap-1.5">
            <PlayCircle size={13} className="text-white/40" />
            <strong className="text-white font-semibold">{withVideoCount}</strong> con video
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 min-h-0">
        {lessons.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white/[0.01] border border-dashed border-white/10 rounded-xl">
            <Film size={36} className="mx-auto text-white/15 mb-4" />
            <p className="text-white/60 font-medium mb-1">Este módulo está vacío</p>
            <p className="text-sm text-textMuted mb-5">Agregá la primera lección para empezar.</p>
            <button
              onClick={onCreateLesson}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold hover:bg-goldHover text-black text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={15} strokeWidth={2.5} /> Añadir lección
            </button>
          </div>
        ) : (
          <>
            {lessons.map((lesson, idx) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={idx}
                onEdit={() => onEditLesson(lesson)}
                onTogglePublish={() => onTogglePublishLesson(lesson)}
                onDelete={() => onDeleteLesson(lesson)}
              />
            ))}
            <button
              onClick={onCreateLesson}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 rounded-xl text-white/50 hover:text-gold hover:border-gold/30 hover:bg-gold/[0.03] transition-all text-sm font-semibold"
            >
              <Plus size={16} /> Añadir lección
            </button>
          </>
        )}
      </div>
    </div>
  );
};

interface LessonRowProps {
  lesson: Lesson;
  index: number;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}

const LessonRow = ({ lesson, index, onEdit, onTogglePublish, onDelete }: LessonRowProps) => {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border transition-colors",
        lesson.is_published
          ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
          : "bg-transparent border-dashed border-white/10 opacity-70 hover:opacity-100"
      )}
    >
      <span
        className={cn(
          "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono",
          lesson.is_published ? "bg-gold/10 text-gold border border-gold/20" : "bg-white/5 text-white/40"
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-white truncate min-w-0">{lesson.title}</p>
          {!lesson.is_published && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-white/5 text-white/50 px-1.5 py-0.5 rounded">
              Borrador
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lesson.stream_uid ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-green-300 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
              <PlayCircle size={10} /> Video listo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              <AlertCircle size={10} /> Sin video
            </span>
          )}
          {lesson.allowed_plans?.map((plan) => (
            <span
              key={plan}
              className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded capitalize",
                PLAN_BADGE_STYLES[plan as Plan]
              )}
            >
              {plan}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={onTogglePublish}
          className={cn(
            "p-2 rounded-lg transition-colors",
            lesson.is_published
              ? "text-white/50 hover:text-white hover:bg-white/10"
              : "text-amber-400 hover:bg-amber-500/15"
          )}
          aria-label={lesson.is_published ? "Ocultar" : "Publicar"}
        >
          {lesson.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Editar"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          aria-label="Eliminar"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};
