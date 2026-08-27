-- Per-user chat notification preferences. A muted chat still receives messages,
-- but its new messages do not create notification rows for that recipient.

CREATE TABLE IF NOT EXISTS chat_notification_preferences (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_muted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

ALTER TABLE chat_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_notification_preferences: user select"
  ON chat_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "chat_notification_preferences: user insert"
  ON chat_notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_notification_preferences: user update"
  ON chat_notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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
    AND membership.user_id <> NEW.sender_id
    AND NOT EXISTS (
      SELECT 1
      FROM chat_notification_preferences AS preference
      WHERE preference.user_id = membership.user_id
        AND preference.group_id = NEW.group_id
        AND preference.is_muted
    );

  RETURN NEW;
END;
$$;
