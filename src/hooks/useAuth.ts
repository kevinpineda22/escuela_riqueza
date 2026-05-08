import { useShallow } from "zustand/react/shallow";
import { signIn as apiSignIn, signUp as apiSignUp, signOut as apiSignOut } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth.store";
import type { LoginInput, SignupInput } from "@/schemas/auth.schema";

export function useAuth() {
  const { user, token, setSession, clearSession } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      token: state.token,
      setSession: state.setSession,
      clearSession: state.clearSession,
    }))
  );

  const signIn = async (input: LoginInput) => {
    const result = await apiSignIn(input);
    setSession(result.user, result.token);
    return result.user;
  };

  const signUp = async (input: SignupInput) => {
    const result = await apiSignUp(input);
    setSession(result.user, result.token);
    return result.user;
  };

  const signOut = async () => {
    await apiSignOut();
    clearSession();
  };

  return {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    signIn,
    signUp,
    signOut,
  };
}
