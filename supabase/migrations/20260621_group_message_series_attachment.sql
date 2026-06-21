-- Allow series attachments in chat messages.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'group_messages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%attachment_type IN%'
  LOOP
    EXECUTE format('ALTER TABLE group_messages DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE group_messages
  ADD CONSTRAINT group_messages_attachment_type_check
  CHECK (attachment_type IN ('book', 'note', 'author', 'series'));

NOTIFY pgrst, 'reload schema';
