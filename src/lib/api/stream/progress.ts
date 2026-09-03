import { supabase } from "@/lib/supabase";

export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  progress_seconds: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Lecciones que ya alcanzaron el 100% en esta sesión o que la base reportó como
 * completadas. Completar una lección es irreversible: volver a verla desde el inicio
 * NO puede marcarla como incompleta ni bajar el progreso del módulo.
 */
const completedLessons = new Set<string>();

function rememberCompleted(lessonId: string | number, completed: boolean) {
  if (completed) completedLessons.add(String(lessonId));
}

export function isKnownCompleted(lessonId: string | number): boolean {
  return completedLessons.has(String(lessonId));
}

export async function fetchUserProgress(lessonId: string): Promise<UserLessonProgress | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("user_lesson_progress")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching progress:", error);
    return null;
  }
  if (data) rememberCompleted(data.lesson_id, data.is_completed);
  return data;
}

export async function saveUserProgress(lessonId: string, progressSeconds: number, isCompleted: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  // Una lección completada NUNCA vuelve a incompleta: al repasarla desde el inicio,
  // el cálculo del 90% da false y este upsert pisaba el true anterior, borrando el
  // avance del módulo hasta que el alumno la terminaba de nuevo.
  const completed = isCompleted || isKnownCompleted(lessonId);
  rememberCompleted(lessonId, completed);

  const { error } = await supabase
    .from("user_lesson_progress")
    .upsert({
      user_id: userData.user.id,
      lesson_id: lessonId,
      progress_seconds: Math.floor(progressSeconds),
      is_completed: completed
    }, {
      onConflict: 'user_id,lesson_id'
    });

  if (error) {
    console.error("Error saving progress:", error);
  }
}

/** Una lección se considera completada al llegar al 90% de su duración. */
const COMPLETION_RATIO = 0.9;

export function isLessonCompleted(progressSeconds: number, durationSeconds: number): boolean {
  return durationSeconds > 0 && progressSeconds / durationSeconds >= COMPLETION_RATIO;
}

/**
 * `progress_seconds` responde "¿dónde retomo?". Si la lección llegó al final no hay
 * nada pendiente, así que se guarda 0 y al volver arranca desde el principio en vez
 * de ofrecer retomar en el último segundo.
 */
export function resumePoint(progressSeconds: number, durationSeconds?: number | null): number {
  const duration = Number(durationSeconds);
  if (Number.isFinite(duration) && duration > 0 && progressSeconds >= duration - 1) return 0;
  return progressSeconds;
}

/**
 * Persiste el minuto exacto de una lección. Pensado para los momentos de
 * transición — activar/salir del modo podcast, cerrar el reproductor, dejar la
 * lección o esconder la pestaña — donde el guardado periódico de cada 10s no
 * alcanza y el usuario perdería hasta 10 segundos de avance.
 *
 * Es tolerante a valores ausentes: si no hay lección o el tiempo todavía no es
 * válido, no escribe nada en vez de guardar un progreso falso.
 */
export async function flushLessonProgress(
  lessonId: string | number | null | undefined,
  progressSeconds: number | null | undefined,
  durationSeconds?: number | null,
  forceCompleted = false
): Promise<void> {
  if (lessonId === null || lessonId === undefined) return;

  const seconds = Number(progressSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return;

  const duration = Number(durationSeconds);
  const completed = forceCompleted || isLessonCompleted(seconds, Number.isFinite(duration) ? duration : 0);

  await saveUserProgress(String(lessonId), resumePoint(seconds, durationSeconds), completed);
}

export async function fetchAllUserProgress(): Promise<{ lesson_id: string, is_completed: boolean }[]> {
  const { data, error } = await supabase
    .from("user_lesson_progress")
    .select("lesson_id, is_completed");
    
  if (error) {
    console.error("Error fetching all progress:", error);
    return [];
  }
  // Alimenta el registro de completadas apenas entra al dashboard, para que el guardado
  // no degrade una lección terminada aunque el alumno la repase tras recargar la página.
  for (const row of data || []) rememberCompleted(row.lesson_id, row.is_completed);
  return data || [];
}
