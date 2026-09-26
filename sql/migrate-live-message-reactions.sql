-- Reactions on live-chat messages.
--
-- Model: one row per (message, user, emoji). A user can react to a message
-- with each of the 4 allowed emojis at most once (enforced by the composite
-- primary key), and removes a reaction by deleting that same row. Counts are
-- derived client-side by aggregating rows per message_id/emoji — there is no
-- denormalized counter column, so there is nothing to keep in sync.
--
-- We store short KEYS ('heart', 'fire', 'clap', 'raised_hands'), not the raw
-- unicode emoji, to avoid variation-selector / ZWJ-sequence mismatches
-- between clients (e.g. "❤" vs "❤️").
--
-- `live_id` is denormalized onto this table (instead of joining through
-- live_messages for every RLS check) so the INSERT policy can cheaply verify
-- the message actually belongs to the live_id the client claims, without a
-- subquery join on every read.

CREATE TABLE IF NOT EXISTS public.live_message_reactions (
  message_id uuid NOT NULL REFERENCES public.live_messages(id) ON DELETE CASCADE,
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('heart', 'fire', 'clap', 'raised_hands')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS live_message_reactions_live_id_idx ON public.live_message_reactions (live_id);

ALTER TABLE public.live_message_reactions ENABLE ROW LEVEL SECURITY;

-- Same visibility as live_messages: any authenticated user can see all
-- reactions of any live they can already read messages for.
DROP POLICY IF EXISTS "Allow read live_message_reactions authenticated" ON public.live_message_reactions;
CREATE POLICY "Allow read live_message_reactions authenticated" ON public.live_message_reactions
  FOR SELECT TO authenticated
  USING (true);

-- WITH CHECK confirms `message_id` really belongs to `live_id` — without
-- this a client could spoof `live_id` on insert and make a reaction show up
-- attached to a live it doesn't belong to.
DROP POLICY IF EXISTS "Allow insert live_message_reactions authenticated" ON public.live_message_reactions;
CREATE POLICY "Allow insert live_message_reactions authenticated" ON public.live_message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.live_messages m
      WHERE m.id = message_id
        AND m.live_id = live_message_reactions.live_id
    )
  );

-- A user can only remove their own reaction. No UPDATE policy: toggling a
-- reaction is delete + insert, never an update.
DROP POLICY IF EXISTS "Allow delete live_message_reactions own" ON public.live_message_reactions;
CREATE POLICY "Allow delete live_message_reactions own" ON public.live_message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Realtime, idempotently (ALTER PUBLICATION ... ADD TABLE errors if the
-- table is already a member, unlike the other DDL in this file).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_message_reactions;
  END IF;
END $$;

-- Token-gated read for anonymous visitors of a public live link (mirrors
-- get_public_live_messages in migrate-lives-public-link.sql). Returns
-- aggregated counts, not per-user rows, so anon never learns who reacted.
-- Does NOT touch get_public_live_messages itself — changing its return type
-- would require DROP FUNCTION and risk breaking a running public page.
CREATE OR REPLACE FUNCTION public.get_public_live_reactions(p_token text)
RETURNS TABLE (
  message_id uuid,
  emoji text,
  total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.message_id, r.emoji, count(*) AS total
  FROM public.live_message_reactions r
  JOIN public.lives l ON l.id = r.live_id
  WHERE l.share_token = p_token
    AND l.is_public = true
  GROUP BY r.message_id, r.emoji;
$$;

REVOKE ALL ON FUNCTION public.get_public_live_reactions(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_live_reactions(text) TO anon, authenticated;
