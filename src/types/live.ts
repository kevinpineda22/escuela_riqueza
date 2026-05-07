import type { Plan } from "@/types/user";

export const LIVE_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  ENDED: "ended",
} as const;

export type LiveStatus = (typeof LIVE_STATUS)[keyof typeof LIVE_STATUS];

export interface Live {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  streamLiveInputId: string | null;
  requiredPlan: Plan;
  status: LiveStatus;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  liveId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}
