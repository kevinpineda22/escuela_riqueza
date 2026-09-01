import { supabase } from "@/lib/supabase";
import * as tus from "tus-js-client";
import { authedFetch } from "@/lib/api/client";

export interface Module {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  allowed_plans: ("free" | "individual" | "vip")[];
  is_published: boolean;
  created_at: string;
  badge_image_url?: string | null;
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

// --- REORDENAR MÓDULOS ---

export async function updateModuleOrder(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("modules").update({ order_index: index }).eq("id", id)
    )
  );
  const err = results.find(r => r.error);
  if (err) throw err.error;
}

// --- REORDENAR LECCIONES ---

export async function updateLessonOrder(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("lessons").update({ order_index: index }).eq("id", id)
    )
  );
  const err = results.find(r => r.error);
  if (err) throw err.error;
}

// --- CLOUDFLARE ---

export async function getDirectUploadUrl(size: number, name?: string): Promise<{ uploadURL: string; uid: string }> {
  const res = await authedFetch('/api/stream/upload-url', {
    method: 'POST',
    body: JSON.stringify({ size, name })
  });

  if (!res.ok) {
    throw new Error('Fallo al solicitar URL de subida a Vercel');
  }

  const data = await res.json();
  return data;
}

export function uploadFileWithProgress(
  uploadURL: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        uploadUrl: uploadURL,
        chunkSize: 50 * 1024 * 1024, // 50 MB
        retryDelays: [0, 3000, 5000, 10000, 20000],
      removeFingerprintOnSuccess: true,
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      onProgress: (bytesUploaded: number, bytesTotal: number) => {
        if (bytesTotal > 0) {
          onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        }
      },
      onSuccess: () => resolve(),
      onError: (error: Error | tus.DetailedError) => {
        const msg = error instanceof tus.DetailedError
          ? `Upload failed (HTTP ${error.originalResponse?.getStatus() || "unknown"})`
          : error.message;
        reject(new Error(msg));
      },
    });

    upload.start();
  });
}
