-- Save receipts are opt-out for every new and existing chat preference.

ALTER TABLE chat_notification_preferences
  ALTER COLUMN save_receipts SET DEFAULT true;

UPDATE chat_notification_preferences
SET save_receipts = true;
