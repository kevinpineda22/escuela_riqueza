import { supabase } from "@/lib/supabase";
import type { EmailOutcome } from "@/lib/emailDelivery";
import { adminUsersRequest } from "./users";

export interface EmailDelivery extends EmailOutcome {
  email_id: string;
  recipient: string;
  subject: string | null;
  sent_at: string;
  status_at: string;
}

export interface EmailIssue extends EmailOutcome {
  user_id: string;
  recipient: string;
  subject: string | null;
  sent_at: string;
  status_at: string;
}

/** Usuarios cuyo correo actual tiene un problema, por id de usuario. */
export async function fetchEmailIssues(): Promise<Record<string, EmailIssue>> {
  const { data, error } = await supabase.rpc("admin_email_issues");
  if (error) throw error;
  const map: Record<string, EmailIssue> = {};
  for (const issue of (data as EmailIssue[] | null) ?? []) map[issue.user_id] = issue;
  return map;
}

export async function fetchUserEmails(userId: string): Promise<EmailDelivery[]> {
  const { data, error } = await supabase.rpc("admin_user_emails", { target_user_id: userId });
  if (error) throw error;
  return (data as EmailDelivery[] | null) ?? [];
}

export interface EmailBlock {
  email: string | null;
  /** `null`: no se pudo comprobar (por ejemplo, la API key solo puede enviar). */
  blocked: boolean | null;
}

export async function fetchEmailBlock(userId: string): Promise<EmailBlock> {
  return adminUsersRequest<EmailBlock>({ action: "email_block", user_id: userId });
}

export async function removeEmailBlock(userId: string): Promise<void> {
  await adminUsersRequest<{ ok: true }>({ action: "remove_email_block", user_id: userId });
}
