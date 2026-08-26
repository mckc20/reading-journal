-- Track library imports per user and attachment message so each attachment
-- can be imported only once by a recipient.

CREATE TABLE IF NOT EXISTS chat_attachment_saves (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS chat_attachment_saves_user_message_idx
  ON chat_attachment_saves (user_id, message_id);

ALTER TABLE chat_attachment_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_attachment_saves: user select"
  ON chat_attachment_saves FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "chat_attachment_saves: user insert"
  ON chat_attachment_saves FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM group_messages AS message
      JOIN group_memberships AS membership ON membership.group_id = message.group_id
      WHERE message.id = chat_attachment_saves.message_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND message.attachment_payload IS NOT NULL
    )
  );

-- Ensure shared book covers can be copied into the recipient's own folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS covers_public_read ON storage.objects;
CREATE POLICY covers_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

DROP POLICY IF EXISTS covers_insert_own ON storage.objects;
CREATE POLICY covers_insert_own
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'covers'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS covers_update_own ON storage.objects;
CREATE POLICY covers_update_own
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'covers'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'covers'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS covers_delete_own ON storage.objects;
CREATE POLICY covers_delete_own
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'covers'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
