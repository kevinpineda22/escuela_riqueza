-- Create table for tracking lesson progress
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL, -- Assuming lessons.id is TEXT or change to UUID if appropriate
    progress_seconds INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own progress
CREATE POLICY "Users can view their own progress" ON public.user_lesson_progress
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own progress
CREATE POLICY "Users can insert/update their own progress" ON public.user_lesson_progress
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_lesson_progress_updated_at ON public.user_lesson_progress;
CREATE TRIGGER update_user_lesson_progress_updated_at
    BEFORE UPDATE ON public.user_lesson_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
