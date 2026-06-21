-- Add snapshot attachments to chat messages.
-- Attachment messages may have empty text as long as they carry a valid payload.

ALTER TABLE group_messages
  ADD COLUMN IF NOT EXISTS attachment_type text
    CHECK (attachment_type IN ('book', 'note', 'author')),
  ADD COLUMN IF NOT EXISTS attachment_payload jsonb;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'group_messages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%btrim(content)%'
      AND conname <> 'group_messages_content_or_attachment_check'
  LOOP
    EXECUTE format('ALTER TABLE group_messages DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'group_messages_content_or_attachment_check'
      AND conrelid = 'group_messages'::regclass
  ) THEN
    ALTER TABLE group_messages
      ADD CONSTRAINT group_messages_content_or_attachment_check
      CHECK (
        deleted_at IS NOT NULL
        OR length(btrim(content)) > 0
        OR (
          attachment_type IS NOT NULL
          AND attachment_payload IS NOT NULL
          AND jsonb_typeof(attachment_payload) = 'object'
        )
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS group_messages_attachment_type_idx
  ON group_messages(attachment_type)
  WHERE attachment_type IS NOT NULL;

NOTIFY pgrst, 'reload schema';
