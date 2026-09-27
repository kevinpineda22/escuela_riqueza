import { useState } from "react";
import type { ReplyTarget } from "@/lib/chat/replyTo";

export interface UseReplyTargetResult {
  replyTarget: ReplyTarget | null;
  startReply: (target: ReplyTarget) => void;
  cancelReply: () => void;
}

/**
 * Tracks the message currently being replied to in a chat composer. Kept as
 * a tiny standalone hook so LiveChat doesn't grow this state (and its
 * start/cancel logic) inline — see docs/CHANGELOG.md 2026-09-27.
 */
export function useReplyTarget(): UseReplyTargetResult {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  return {
    replyTarget,
    startReply: setReplyTarget,
    cancelReply: () => setReplyTarget(null),
  };
}
