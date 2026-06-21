-- Add reply snapshots and heart reactions to chat messages.

ALTER TABLE group_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES group_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_snapshot jsonb;

CREATE TABLE IF NOT EXISTS group_message_reactions (
  message_id uuid NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction = 'heart'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS group_messages_reply_to_message_id_idx
  ON group_messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS group_message_reactions_user_id_idx
  ON group_message_reactions(user_id);

ALTER TABLE group_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_message_reactions: member select"
  ON group_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM group_messages
      WHERE group_messages.id = group_message_reactions.message_id
        AND is_active_group_member(group_messages.group_id, auth.uid())
    )
  );

CREATE POLICY "group_message_reactions: member insert own"
  ON group_message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM group_messages
      WHERE group_messages.id = group_message_reactions.message_id
        AND group_messages.deleted_at IS NULL
        AND is_active_group_member(group_messages.group_id, auth.uid())
    )
  );

CREATE POLICY "group_message_reactions: member delete own"
  ON group_message_reactions FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM group_messages
      WHERE group_messages.id = group_message_reactions.message_id
        AND is_active_group_member(group_messages.group_id, auth.uid())
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_message_reactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
