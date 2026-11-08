-- Student activity tracking for the admin Overview. Nullable, no defaults, no changes to existing columns.
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS in_exam_at    TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_students_last_seen ON students (last_seen_at);
