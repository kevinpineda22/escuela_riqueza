import type { Plan } from "@/types/user";

export interface Module {
  id: string;
  slug: string;
  title: string;
  description: string;
  iconKey: string;
  orderIndex: number;
  isPublished: boolean;
}

export interface Lesson {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  description: string;
  orderIndex: number;
  durationSeconds: number;
  videoUrl: string | null;
  streamUid: string | null;
  isPremium: boolean;
  requiredPlan: Plan;
  isPublished: boolean;
  createdAt: string;
}

export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}
