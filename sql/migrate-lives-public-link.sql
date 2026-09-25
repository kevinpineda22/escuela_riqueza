-- Public shareable live link.
--
-- Security model: anon NEVER gets a direct SELECT policy on `lives` or
-- `live_messages`. All anonymous access goes through two SECURITY DEFINER
-- functions gated by `share_token` + `is_public = true`. Writes to
-- `is_public` / `share_token` are already restricted to admins by the
-- existing RLS policies on `lives` (see sql/migrate-lives-rls-admin.sql) —
-- no additional write policy is needed here.

ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- Returns the public live row matching a share token, only if it is
-- currently marked public. Used by the public room page (no auth required).
CREATE OR REPLACE FUNCTION public.get_public_live(p_token text)
RETURNS SETOF public.lives
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.lives
  WHERE share_token = p_token
    AND is_public = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_live(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_live(text) TO anon, authenticated;

-- Returns the last `p_limit` chat messages for a public live, joined with the
-- author's display name. Only works while the live is `is_public = true` —
-- if the admin turns the link off, the function stops returning rows even
-- with a still-valid token.
--
-- The inner query picks the NEWEST rows (DESC + LIMIT) and the outer one puts
-- them back in reading order. A plain `ORDER BY ASC LIMIT` returned the FIRST
-- 100 messages instead, so from message 101 on the public chat stopped
-- showing anything new (docs/LIVE_UX_REDESIGN_AUDIT.md F21).
CREATE OR REPLACE FUNCTION public.get_public_live_messages(p_token text, p_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  message text,
  created_at timestamptz,
  user_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT recent.id, recent.user_id, recent.message, recent.created_at, recent.user_name
  FROM (
    SELECT
      m.id,
      m.user_id,
      m.content AS message,
      m.created_at,
      coalesce(p.full_name, 'Usuario') AS user_name
    FROM public.live_messages m
    JOIN public.lives l ON l.id = m.live_id
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE l.share_token = p_token
      AND l.is_public = true
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 200)
  ) recent
  ORDER BY recent.created_at ASC, recent.id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_public_live_messages(text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_live_messages(text, int) TO anon, authenticated;
