-- =========================================================
-- Supabase Exams & Questions Tables: Row Level Security (RLS) Setup
-- Run this in the Supabase Dashboard -> SQL Editor
-- =========================================================

-- 1. Ensure RLS is enabled on exams and questions
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Anyone can view active exams" ON public.exams;
DROP POLICY IF EXISTS "Candidates can view published exams" ON public.exams;
DROP POLICY IF EXISTS "Admins can manage all exams" ON public.exams;
DROP POLICY IF EXISTS "Anyone can view questions for active exams" ON public.questions;
DROP POLICY IF EXISTS "Candidates can view questions for active exams" ON public.questions;
DROP POLICY IF EXISTS "Admins can manage all questions" ON public.questions;

-- 3. EXAMS TABLE POLICIES:
-- Allow authenticated candidates and anonymous users to view published/active exams
CREATE POLICY "Candidates can view published exams"
ON public.exams
FOR SELECT
TO authenticated, anon
USING (is_active = true);

-- Allow admins full access (SELECT, INSERT, UPDATE, DELETE) to all exams
CREATE POLICY "Admins can manage all exams"
ON public.exams
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. QUESTIONS TABLE POLICIES:
-- Allow candidates to view questions for published exams
CREATE POLICY "Candidates can view questions for active exams"
ON public.questions
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.exams
    WHERE exams.id = questions.exam_id AND exams.is_active = true
  )
);

-- Allow admins full access to all questions
CREATE POLICY "Admins can manage all questions"
ON public.questions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
