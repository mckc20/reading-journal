-- Allow series attachments in chat messages.

ALTER TABLE group_messages
  DROP CONSTRAINT IF EXISTS group_messages_attachment_type_check;

ALTER TABLE group_messages
  ADD CONSTRAINT group_messages_attachment_type_check
  CHECK (attachment_type IN ('book', 'note', 'author', 'series'));

NOTIFY pgrst, 'reload schema';
