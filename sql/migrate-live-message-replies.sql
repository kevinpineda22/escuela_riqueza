-- WhatsApp-style "reply to a message" for the live chat.
--
-- Deploy order: run this file in Supabase FIRST, then deploy the frontend.
-- The old frontend keeps working unmodified against the new
-- get_public_live_messages signature (it simply ignores the 3 extra
-- columns), so there is no window where the app is broken.
--
-- Security model: the quoted author name / excerpt shown on a reply must
-- NEVER be trusted from the client — otherwise any authenticated user could
-- insert a message that "quotes" something Iván (or anyone else) never
-- actually said. `reply_to_user_id`, `reply_to_user_name` and
-- `reply_to_excerpt` are therefore write-only from the server's point of
-- view: the client only ever sends `reply_to_id`, and a SECURITY DEFINER
-- trigger derives the other three from the real parent row before the write
-- lands. See the trigger function below for the full reasoning, including
-- how it interacts with the delete-cleanup trigger.

-- 1. Columns -----------------------------------------------------------

ALTER TABLE public.live_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.live_messages(id) ON DELETE SET NULL;
ALTER TABLE public.live_messages ADD COLUMN IF NOT EXISTS reply_to_user_id uuid;
ALTER TABLE public.live_messages ADD COLUMN IF NOT EXISTS reply_to_user_name text;
ALTER TABLE public.live_messages ADD COLUMN IF NOT EXISTS reply_to_excerpt text;

-- Needed for the FK's ON DELETE SET NULL lookup (finds every child of a
-- message being deleted) and for the delete-cleanup trigger's own UPDATE.
CREATE INDEX IF NOT EXISTS live_messages_reply_to_id_idx ON public.live_messages (reply_to_id);

-- 2. Derive-on-write trigger --------------------------------------------
--
-- Fires on INSERT (every new message) and on UPDATE of any of the 4
-- reply_to_* columns (defense in depth: if a future feature ever adds an
-- UPDATE policy on live_messages, e.g. message editing, this still stops a
-- client from writing a fake quote directly). Three cases, handled
-- explicitly so they can't be confused with each other:
--
--   a) INSERT with reply_to_id IS NULL -> not a reply. Force the other 3
--      columns to NULL regardless of what the client sent (sanitizes any
--      stray/spoofed value on an otherwise-normal message).
--
--   b) reply_to_id IS NOT NULL and (INSERT, or UPDATE that points it at a
--      new target) -> look up the parent message IN THE SAME LIVE and
--      derive user_id/name/excerpt from it. A parent that doesn't exist, or
--      belongs to a different live, turns the row into a normal message
--      (all 4 reply columns NULL): a reply can't point outside its own room.
--
--   c) UPDATE where reply_to_id did NOT change -> the only legitimate
--      caller here is the BEFORE DELETE cleanup trigger below, which only
--      ever sets reply_to_excerpt to NULL and never touches reply_to_id.
--      Re-assert OLD's reply_to_user_id/reply_to_user_name unconditionally
--      (blocks a direct spoof attempt on those two columns) and allow
--      reply_to_excerpt to become NULL, but revert any other value back to
--      OLD (blocks a spoof attempt on the excerpt itself).
--
--   d) UPDATE where reply_to_id changed TO NULL -> this is the FK's own
--      "ON DELETE SET NULL" cascade firing on a child after its parent
--      message was deleted. reply_to_user_name must SURVIVE this (the UI
--      still shows "replying to {name}" with "Mensaje eliminado" instead of
--      the excerpt), and reply_to_excerpt was already cleared by the BEFORE
--      DELETE cleanup trigger a moment earlier in the same statement — so
--      this branch just re-asserts OLD's values for all 3 columns rather
--      than nulling them out.
CREATE OR REPLACE FUNCTION public.live_messages_derive_reply_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_to_id IS NULL THEN
      NEW.reply_to_user_id := NULL;
      NEW.reply_to_user_name := NULL;
      NEW.reply_to_excerpt := NULL;
      RETURN NEW;
    END IF;
    -- reply_to_id is set: fall through to the lookup-and-fill below.

  ELSIF NEW.reply_to_id IS NOT DISTINCT FROM OLD.reply_to_id THEN
    -- Case (c): reply_to_id itself is unchanged in this UPDATE.
    NEW.reply_to_user_id := OLD.reply_to_user_id;
    NEW.reply_to_user_name := OLD.reply_to_user_name;
    NEW.reply_to_excerpt := CASE WHEN NEW.reply_to_excerpt IS NULL THEN NULL ELSE OLD.reply_to_excerpt END;
    RETURN NEW;

  ELSIF NEW.reply_to_id IS NULL THEN
    -- Case (d): the FK's ON DELETE SET NULL cascade after the parent was removed.
    NEW.reply_to_user_id := OLD.reply_to_user_id;
    NEW.reply_to_user_name := OLD.reply_to_user_name;
    NEW.reply_to_excerpt := OLD.reply_to_excerpt;
    RETURN NEW;
  END IF;
  -- Else: UPDATE redirecting reply_to_id to a new non-null target. Fall
  -- through to the same lookup-and-fill as the INSERT case (b).

  SELECT m.user_id AS user_id, coalesce(p.full_name, 'Usuario') AS user_name, left(m.content, 140) AS excerpt
    INTO parent
    FROM public.live_messages m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.id = NEW.reply_to_id
      AND m.live_id = NEW.live_id;

  -- Parent missing (deleted while the user was composing the reply) or in a
  -- different live: degrade to a normal message instead of raising. Raising
  -- would make the send fail every retry until the user noticed and cancelled
  -- the quote, and nulling everything is just as safe — no quote is shown.
  IF NOT FOUND THEN
    NEW.reply_to_id := NULL;
    NEW.reply_to_user_id := NULL;
    NEW.reply_to_user_name := NULL;
    NEW.reply_to_excerpt := NULL;
    RETURN NEW;
  END IF;

  NEW.reply_to_user_id := parent.user_id;
  NEW.reply_to_user_name := parent.user_name;
  NEW.reply_to_excerpt := parent.excerpt;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_messages_reply_insert ON public.live_messages;
CREATE TRIGGER trg_live_messages_reply_insert
  BEFORE INSERT ON public.live_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.live_messages_derive_reply_quote();

DROP TRIGGER IF EXISTS trg_live_messages_reply_update ON public.live_messages;
CREATE TRIGGER trg_live_messages_reply_update
  BEFORE UPDATE OF reply_to_id, reply_to_user_id, reply_to_user_name, reply_to_excerpt ON public.live_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.live_messages_derive_reply_quote();

-- 3. Delete cleanup -------------------------------------------------------
--
-- When a quoted message is deleted (moderation, or any future delete path),
-- its text must not keep surviving inside other messages' quotes. This only
-- clears the EXCERPT — reply_to_user_name is intentionally left alone here
-- (see case (d) above) so the UI can still attribute the reply, and
-- reply_to_id is left alone here too: the FK's ON DELETE SET NULL clears it
-- automatically once this row is actually removed, right after this trigger
-- runs.
CREATE OR REPLACE FUNCTION public.live_messages_clear_reply_excerpt_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_messages
  SET reply_to_excerpt = NULL
  WHERE reply_to_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_messages_clear_reply_on_delete ON public.live_messages;
CREATE TRIGGER trg_live_messages_clear_reply_on_delete
  BEFORE DELETE ON public.live_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.live_messages_clear_reply_excerpt_on_delete();

-- 4. Public link RPC --------------------------------------------------------
--
-- Adds the 3 reply columns anon needs to render a quote on the public
-- (token-gated, read-only) live link. reply_to_user_id is intentionally NOT
-- exposed here — anon has no session to compare it against, so it has no use
-- for it (unlike the authenticated LiveChat, which uses it for the "replied
-- to you" highlight).
--
-- Changing a function's return type requires dropping it first.
DROP FUNCTION IF EXISTS public.get_public_live_messages(text, int);

CREATE OR REPLACE FUNCTION public.get_public_live_messages(p_token text, p_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  message text,
  created_at timestamptz,
  user_name text,
  reply_to_id uuid,
  reply_to_user_name text,
  reply_to_excerpt text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT recent.id, recent.user_id, recent.message, recent.created_at, recent.user_name,
         recent.reply_to_id, recent.reply_to_user_name, recent.reply_to_excerpt
  FROM (
    SELECT
      m.id,
      m.user_id,
      m.content AS message,
      m.created_at,
      coalesce(p.full_name, 'Usuario') AS user_name,
      m.reply_to_id,
      m.reply_to_user_name,
      m.reply_to_excerpt
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

-- 5. Realtime ---------------------------------------------------------------
--
-- No publication change needed: live_messages is already added to
-- supabase_realtime (sql/migrate-lives-schema.sql). The 4 new columns are
-- filled by the BEFORE INSERT trigger above before the row is written, so
-- they arrive automatically in every INSERT payload Realtime broadcasts.
