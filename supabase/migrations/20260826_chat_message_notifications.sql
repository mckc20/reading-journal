-- Recipient-specific message notifications. Rows are created only by the
-- message trigger, so clients cannot notify arbitrary users.

CREATE TABLE IF NOT EXISTS chat_message_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT 'Someone',
  message_preview text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (recipient_id, message_id)
);

CREATE INDEX IF NOT EXISTS chat_message_notifications_recipient_unread_idx
  ON chat_message_notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE chat_message_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_message_notifications: recipient select"
  ON chat_message_notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION create_chat_message_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_display_name text;
  preview text;
BEGIN
  SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(username), ''), 'Someone')
  INTO sender_display_name
  FROM profiles
  WHERE id = NEW.sender_id;

  preview := NULLIF(btrim(NEW.content), '');
  IF preview IS NULL THEN
    preview := CASE NEW.attachment_type
      WHEN 'book' THEN 'Shared a book'
      WHEN 'author' THEN 'Shared an author'
      WHEN 'series' THEN 'Shared a series'
      WHEN 'note' THEN 'Shared a journal entry'
      ELSE 'Shared content'
    END;
  END IF;

  INSERT INTO chat_message_notifications (
    recipient_id,
    group_id,
    message_id,
    sender_id,
    sender_name,
    message_preview
  )
  SELECT
    membership.user_id,
    NEW.group_id,
    NEW.id,
    NEW.sender_id,
    COALESCE(sender_display_name, 'Someone'),
    left(preview, 280)
  FROM group_memberships AS membership
  WHERE membership.group_id = NEW.group_id
    AND membership.status = 'active'
    AND membership.user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_messages_create_notifications ON group_messages;

CREATE TRIGGER group_messages_create_notifications
  AFTER INSERT ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_chat_message_notifications();

CREATE OR REPLACE FUNCTION mark_chat_notification_read(notification_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  UPDATE chat_message_notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = notification_uuid
    AND recipient_id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_chat_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION mark_group_read(group_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NOT is_active_group_member(group_uuid, current_user_id) THEN
    RAISE EXCEPTION 'You must be an active group member.';
  END IF;

  UPDATE group_memberships
  SET last_read_at = now()
  WHERE group_id = group_uuid
    AND user_id = current_user_id;

  UPDATE chat_message_notifications
  SET read_at = now()
  WHERE group_id = group_uuid
    AND recipient_id = current_user_id
    AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_group_read(uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
