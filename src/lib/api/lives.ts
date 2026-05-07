import { ApiError, delay } from "@/lib/api/client";
import { MOCK_CHAT_MESSAGES, MOCK_LIVES } from "@/mocks/lives";
import type { ChatMessage, Live } from "@/types/live";

export async function listLives(): Promise<Live[]> {
  await delay();
  return [...MOCK_LIVES].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export async function getLive(id: string): Promise<Live> {
  await delay();
  const live = MOCK_LIVES.find((candidate) => candidate.id === id);
  if (!live) {
    throw new ApiError("live_not_found", `Live no encontrado: ${id}`, 404);
  }
  return live;
}

export async function listChatMessages(liveId: string): Promise<ChatMessage[]> {
  await delay(80);
  return MOCK_CHAT_MESSAGES.filter((m) => m.liveId === liveId);
}
