-- Admin moderation of the live chat: let admins delete messages.
--
-- Deploy order: run this file in Supabase BEFORE (or together with) the
-- frontend that ships the moderation UI. The old frontend never issues a
-- DELETE on live_messages, so running the SQL first is always safe. If the
-- frontend ships first, the delete button would simply fail with a toast and
-- roll the message back (RLS blocks the delete).
--
-- Until now live_messages had only SELECT and INSERT policies (see
-- migrate-lives-schema.sql), so no client could delete a message. Deleting a
-- whole live still works because the lives -> live_messages cascade is a
-- referential action, which runs as the table owner and ignores RLS.
--
-- Scope: DELETE only, admins only (same profile-role pattern as
-- migrate-lives-rls-admin.sql). No UPDATE policy is added — there is no
-- muting/banning/editing in this feature.

ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete live_messages" ON public.live_messages;
CREATE POLICY "Admins can delete live_messages" ON public.live_messages
  FOR DELETE TO authenticated
  USING (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Side effects of deleting one message (verified against the existing schema,
-- nothing to change):
--
--   * live_message_reactions.message_id is ON DELETE CASCADE
--     (migrate-live-message-reactions.sql): the reactions of the deleted
--     message go with it. Referential actions bypass RLS, so the "delete own
--     reaction" policy does not get in the way. Realtime emits one DELETE per
--     reaction row; the clients already handle those (useLiveReactions).
--
--   * Replies to the deleted message are handled by the FK
--     reply_to_id ... ON DELETE SET NULL plus the BEFORE UPDATE trigger of
--     migrate-live-message-replies.sql (case d): reply_to_id becomes NULL, the
--     excerpt is dropped and reply_to_user_id / reply_to_user_name survive, so
--     the UI shows "Mensaje eliminado" with attribution. The SET NULL is an
--     AFTER-style referential action on rows the statement did NOT delete, so
--     it does not hit the 27000 "tuple already modified" error that the old
--     BEFORE DELETE trigger caused (fixed in commit 340548a). It also needs no
--     UPDATE policy: referential actions run as the table owner.
--     Realtime does NOT send those child updates to LiveChat (it only listens
--     to INSERT/DELETE), so the client rewrites the replies locally on the
--     DELETE event with the same shape (see src/lib/chat/removeMessage.ts).
--
--   * The anonymous public link reads through get_public_live_messages, which
--     simply stops returning the deleted row and returns the replies with the
--     updated reply_to_* columns on the next poll.

-- Realtime: live_messages must be in the supabase_realtime publication so the
-- DELETE event reaches every open chat. migrate-lives-schema.sql adds it, but
-- that ALTER errors if the table is already a member, so this block is the
-- idempotent re-check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;
  END IF;
END $$;

-- Realtime and DELETE events: Postgres Changes cannot filter DELETE events by
-- column (unless REPLICA IDENTITY FULL, which we deliberately do not enable)
-- and does not apply RLS to them. With the default replica identity the
-- payload's `old` carries only the primary key (`id`), which is all the client
-- needs. Every subscriber to the table receives the event; the client ignores
-- ids it does not have.

-- Verification (run as a non-admin user: it must delete 0 rows, no error —
-- RLS silently filters the row; the client treats 0 deleted rows as a failure):
-- delete from public.live_messages where id = '<any-message-id>' returning id;
