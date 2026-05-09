import { supabase } from "@/lib/supabase";

export interface Module {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  allowed_plans: ("free" | "individual" | "vip")[];
  is_published: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  order_index: number;
  stream_uid: string | null;
  allowed_plans: ("free" | "individual" | "vip")[];
  is_published: boolean;
  created_at: string;
}

// --- MODULOS ---

export async function fetchModules(): Promise<Module[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createModule(title: string, description: string = "", allowed_plans: ("free" | "individual" | "vip")[] = ["free", "individual", "vip"]): Promise<Module> {
  const { data: countData } = await supabase.from("modules").select("id", { count: "exact" });
  const count = countData ? countData.length : 0;

  const { data, error } = await supabase
    .from("modules")
    .insert([{ title, description, allowed_plans, order_index: count }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateModule(id: string, updates: Partial<Module>): Promise<Module> {
  const { data, error } = await supabase
    .from("modules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase.from("modules").delete().eq("id", id);
  if (error) throw error;
}

// --- LECCIONES ---

export async function fetchLessons(moduleId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("module_id", moduleId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLesson(lesson: Partial<Lesson>): Promise<Lesson> {
  const { data: countData } = await supabase
    .from("lessons")
    .select("id", { count: "exact" })
    .eq("module_id", lesson.module_id);
  
  const count = countData ? countData.length : 0;

  const { data, error } = await supabase
    .from("lessons")
    .insert([{ ...lesson, order_index: count }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLesson(id: string, updates: Partial<Lesson>): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) throw error;
}

// --- CLOUDFLARE ---

export async function getDirectUploadUrl(): Promise<{ uploadURL: string; uid: string }> {
  try {
    const res = await fetch('/api/stream/upload-url', {
      method: 'POST'
    });
    
    if (!res.ok) {
      throw new Error('Fallo al solicitar URL de subida a Vercel');
    }
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error obteniendo Direct Upload URL:", err);
    throw err;
  }
}
