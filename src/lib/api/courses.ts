import { ApiError, delay } from "@/lib/api/client";
import { MOCK_LESSONS, MOCK_MODULES } from "@/mocks/courses";
import type { Lesson, Module } from "@/types/course";

export async function listModules(): Promise<Module[]> {
  await delay();
  return MOCK_MODULES.filter((m) => m.isPublished).sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function getModuleBySlug(slug: string): Promise<Module> {
  await delay();
  const module = MOCK_MODULES.find((m) => m.slug === slug && m.isPublished);
  if (!module) {
    throw new ApiError("module_not_found", `Módulo no encontrado: ${slug}`, 404);
  }
  return module;
}

export async function listLessonsByModule(moduleId: string): Promise<Lesson[]> {
  await delay();
  return MOCK_LESSONS.filter((l) => l.moduleId === moduleId && l.isPublished).sort(
    (a, b) => a.orderIndex - b.orderIndex
  );
}

export async function getLessonBySlug(slug: string): Promise<Lesson> {
  await delay();
  const lesson = MOCK_LESSONS.find((l) => l.slug === slug && l.isPublished);
  if (!lesson) {
    throw new ApiError("lesson_not_found", `Lección no encontrada: ${slug}`, 404);
  }
  return lesson;
}
