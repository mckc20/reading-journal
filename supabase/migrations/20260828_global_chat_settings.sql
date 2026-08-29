-- Move chat notification and save-receipt preferences from per-chat rows to
-- account-level user settings.

ALTER TABLE user_settings
  ALTER COLUMN notifications SET DEFAULT '{
    "reading_reminders": false,
    "weekly_summary": false,
    "daily_goal_reminders": false,
    "chat_notifications": true,
    "goal_completion_notifications": true,
    "friend_activity_notifications": false,
    "new_follower_notifications": false
  }'::jsonb,
  ALTER COLUMN privacy SET DEFAULT '{
    "private_account": true,
    "show_reading_activity": false,
    "show_reading_statistics_publicly": false,
    "show_reading_goals_publicly": false,
    "chat_save_receipts": true,
    "allow_followers": false,
    "blocked_users": []
  }'::jsonb;

UPDATE user_settings
SET notifications = notifications || '{"chat_notifications": true}'::jsonb
WHERE NOT (notifications ? 'chat_notifications');

UPDATE user_settings
SET privacy = privacy || '{"chat_save_receipts": true}'::jsonb
WHERE NOT (privacy ? 'chat_save_receipts');

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
  LEFT JOIN user_settings AS recipient_settings
    ON recipient_settings.user_id = membership.user_id
  WHERE membership.group_id = NEW.group_id
    AND membership.status = 'active'
    AND membership.user_id <> NEW.sender_id
    AND COALESCE((recipient_settings.notifications ->> 'chat_notifications')::boolean, true);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_chat_attachment_save_receipts(target_message_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    attachment_save.user_id,
    COALESCE(
      NULLIF(btrim(profile.display_name), ''),
      NULLIF(btrim(profile.username), ''),
      'Someone'
    ) AS display_name
  FROM chat_attachment_saves AS attachment_save
  JOIN group_messages AS message
    ON message.id = attachment_save.message_id
  JOIN group_memberships AS sender_membership
    ON sender_membership.group_id = message.group_id
    AND sender_membership.user_id = auth.uid()
    AND sender_membership.status = 'active'
  JOIN group_memberships AS saver_membership
    ON saver_membership.group_id = message.group_id
    AND saver_membership.user_id = attachment_save.user_id
    AND saver_membership.status = 'active'
  LEFT JOIN user_settings AS saver_settings
    ON saver_settings.user_id = attachment_save.user_id
  JOIN profiles AS profile ON profile.id = attachment_save.user_id
  WHERE attachment_save.message_id = target_message_id
    AND message.sender_id = auth.uid()
    AND message.attachment_payload IS NOT NULL
    AND attachment_save.user_id <> message.sender_id
    AND COALESCE((saver_settings.privacy ->> 'chat_save_receipts')::boolean, true)
  ORDER BY attachment_save.saved_at ASC, display_name ASC;
$$;

GRANT EXECUTE ON FUNCTION get_chat_attachment_save_receipts(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
