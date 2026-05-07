import type { Live, ChatMessage } from "@/types/live";
import { LIVE_STATUS } from "@/types/live";
import { PLANS } from "@/types/user";

export const MOCK_LIVES: Live[] = [
  {
    id: "live-001",
    title: "Mentalidad del millonario — Sesión exclusiva",
    description: "Una conversación íntima con Iván Mazo sobre las decisiones que cambian la vida.",
    startsAt: "2026-05-15T20:00:00.000Z",
    durationMinutes: 90,
    streamLiveInputId: null,
    requiredPlan: PLANS.VIP,
    status: LIVE_STATUS.SCHEDULED,
    createdAt: "2026-05-01T10:00:00.000Z",
  },
];

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-001",
    liveId: "live-001",
    userId: "system",
    userName: "Soporte",
    content: "¡Bienvenidos al evento VIP! Empezaremos en breve.",
    createdAt: "2026-05-15T19:55:00.000Z",
  },
];
