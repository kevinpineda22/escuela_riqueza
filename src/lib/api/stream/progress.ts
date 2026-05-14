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

export async function fetchUserProgress(lessonId: string): Promise<UserLessonProgress | null> {
  const { data, error } = await supabase
    .from("user_lesson_progress")
    .select("*")
    .eq("lesson_id", lessonId)
    .maybeSingle();
    
  if (error) {
    console.error("Error fetching progress:", error);
    return null;
  }
  return data;
}

export async function saveUserProgress(lessonId: string, progressSeconds: number, isCompleted: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  
  const { error } = await supabase
    .from("user_lesson_progress")
    .upsert({
      user_id: userData.user.id,
      lesson_id: lessonId,
      progress_seconds: Math.floor(progressSeconds),
      is_completed: isCompleted
    }, {
      onConflict: 'user_id,lesson_id'
    });
    
  if (error) {
    console.error("Error saving progress:", error);
  }
}

export async function fetchAllUserProgress(): Promise<{ lesson_id: string, is_completed: boolean }[]> {
  const { data, error } = await supabase
    .from("user_lesson_progress")
    .select("lesson_id, is_completed");
    
  if (error) {
    console.error("Error fetching all progress:", error);
    return [];
  }
  return data || [];
}
