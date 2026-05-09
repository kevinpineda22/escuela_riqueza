-- Drop existing table since we are migrating from integer IDs to UUIDs (loss of test data is expected)
DROP TABLE IF EXISTS lesson_notes CASCADE;

-- Create lesson_notes table
CREATE TABLE lesson_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own notes
CREATE POLICY "Users can insert their own notes"
ON lesson_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own notes
CREATE POLICY "Users can view their own notes"
ON lesson_notes FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own notes"
ON lesson_notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
ON lesson_notes FOR DELETE
USING (auth.uid() = user_id);

-- Create an index to quickly find a user's note for a specific lesson
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson ON lesson_notes(user_id, lesson_id);
