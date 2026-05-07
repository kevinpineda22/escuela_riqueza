import { delay } from "@/lib/api/client";
import { MOCK_USERS } from "@/mocks/users";
import { SUBSCRIPTION_STATUS } from "@/types/subscription";
import type { Subscription } from "@/types/subscription";

export async function getSubscription(userId: string): Promise<Subscription | null> {
  await delay();
  const user = MOCK_USERS.find((candidate) => candidate.id === userId);
  if (!user) return null;

  return {
    id: `sub-${user.id}`,
    userId: user.id,
    plan: user.plan,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
  };
}
