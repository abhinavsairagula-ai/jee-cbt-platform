-- =========================================================
-- Supabase test_sessions Table Schema & Row Level Security (RLS)
-- Run this in the Supabase Dashboard -> SQL Editor
-- =========================================================

CREATE TABLE IF NOT EXISTS public.test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  marked_for_review JSONB DEFAULT '[]'::jsonb,
  visited JSONB DEFAULT '[]'::jsonb,
  time_remaining_seconds INTEGER NOT NULL DEFAULT 10800,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_test_sessions_user_exam UNIQUE (user_id, exam_id)
);

-- Indexes for high performance lookup
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_exam ON public.test_sessions(user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_status ON public.test_sessions(status);

-- Enable RLS
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view, create, and update their own test sessions
DROP POLICY IF EXISTS "Users can manage own test sessions" ON public.test_sessions;
CREATE POLICY "Users can manage own test sessions"
ON public.test_sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for Admins: Admins can view all test sessions
DROP POLICY IF EXISTS "Admins can view all test sessions" ON public.test_sessions;
CREATE POLICY "Admins can view all test sessions"
ON public.test_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
