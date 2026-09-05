ALTER TABLE reading_logs
  DROP CONSTRAINT IF EXISTS reading_logs_reading_time_minutes_check;

ALTER TABLE reading_logs
  ADD CONSTRAINT reading_logs_reading_time_minutes_check
  CHECK (reading_time_minutes >= 0);
