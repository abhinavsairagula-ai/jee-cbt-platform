-- =========================================================
-- Supabase Submissions Granular Analytics & Telemetry Migration
-- Run this in the Supabase Dashboard -> SQL Editor
-- =========================================================

-- 1. Add question_telemetry and subject_breakdown jsonb columns to public.submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS question_telemetry jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS subject_breakdown jsonb DEFAULT '{}'::jsonb;

-- 2. Ensure Row Level Security is enabled
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow Admins to SELECT all submissions for analytics & results
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
CREATE POLICY "Admins can view all submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Policy: Allow Admins to SELECT all profiles for candidate names & emails in analytics
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
