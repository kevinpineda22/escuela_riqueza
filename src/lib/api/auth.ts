import { ApiError, delay } from "@/lib/api/client";
import { MOCK_PASSWORD, MOCK_USERS } from "@/mocks/users";
import type { LoginInput, SignupInput } from "@/schemas/auth.schema";
import type { User } from "@/types/user";
import { PLANS, USER_ROLES } from "@/types/user";

export interface AuthResult {
  user: User;
  token: string;
}

export async function signIn(input: LoginInput): Promise<AuthResult> {
  await delay();
  const user = MOCK_USERS.find((candidate) => candidate.email === input.email);
  if (!user || input.password !== MOCK_PASSWORD) {
    throw new ApiError("invalid_credentials", "Email o contraseña incorrectos", 401);
  }
  return {
    user,
    token: `mock-token-${user.id}`,
  };
}

export async function signUp(input: SignupInput): Promise<AuthResult> {
  await delay();
  const exists = MOCK_USERS.some((candidate) => candidate.email === input.email);
  if (exists) {
    throw new ApiError("email_taken", "Ese email ya está registrado", 409);
  }
  const newUser: User = {
    id: `user-${crypto.randomUUID()}`,
    email: input.email,
    fullName: input.fullName,
    avatarUrl: null,
    role: USER_ROLES.STUDENT,
    plan: PLANS.FREE,
    createdAt: new Date().toISOString(),
  };
  return {
    user: newUser,
    token: `mock-token-${newUser.id}`,
  };
}

export async function signOut(): Promise<void> {
  await delay(80);
}

export async function getCurrentUser(token: string | null): Promise<User | null> {
  await delay(80);
  if (!token) return null;
  const userId = token.replace("mock-token-", "");
  return MOCK_USERS.find((candidate) => candidate.id === userId) ?? null;
}
