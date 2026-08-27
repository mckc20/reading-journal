-- Add opt-in attachment save receipts without changing the existing chat
-- notification-preferences migration that may already be applied.

ALTER TABLE chat_notification_preferences
  ADD COLUMN IF NOT EXISTS save_receipts boolean NOT NULL DEFAULT false;

-- The sender can see only receipt names for attachments they sent, and only
-- from active chat members who currently chose to share their save activity.
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
  JOIN chat_notification_preferences AS preference
    ON preference.user_id = attachment_save.user_id
    AND preference.group_id = message.group_id
    AND preference.save_receipts
  JOIN profiles AS profile ON profile.id = attachment_save.user_id
  WHERE attachment_save.message_id = target_message_id
    AND message.sender_id = auth.uid()
    AND message.attachment_payload IS NOT NULL
    AND attachment_save.user_id <> message.sender_id
  ORDER BY attachment_save.saved_at ASC, display_name ASC;
$$;

GRANT EXECUTE ON FUNCTION get_chat_attachment_save_receipts(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
