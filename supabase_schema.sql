-- Smart Exam Portal Database Schema (Clean Re-creation)
-- Run this script in the Supabase SQL Editor (Dashboard > Project > SQL Editor)

-- Drop existing stale tables to refresh Supabase schema cache
DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;

-- 1. Create Students Table (with branch field)
CREATE TABLE public.students (
    roll_number VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    password VARCHAR NOT NULL,
    branch VARCHAR NOT NULL DEFAULT '',  -- e.g. CSE, ECE, MECH, CIVIL, IT, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Exams Table
CREATE TABLE public.exams (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    duration INT NOT NULL,
    passing_marks INT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
    shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
    show_result_to_student BOOLEAN NOT NULL DEFAULT TRUE,
    resume_window INT NOT NULL DEFAULT 60, -- Resumption window in minutes
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Results Table (Resilient columns)
CREATE TABLE public.results (
    id VARCHAR PRIMARY KEY,
    exam_id VARCHAR NOT NULL,
    exam_name VARCHAR NOT NULL,
    student_name VARCHAR NOT NULL,
    roll_number VARCHAR NOT NULL,
    branch VARCHAR NOT NULL DEFAULT '', -- student branch stored with result
    date VARCHAR NOT NULL,
    start_time VARCHAR NOT NULL,
    end_time VARCHAR NOT NULL,
    time_taken VARCHAR NOT NULL,
    total_questions INT NOT NULL,
    correct_answers INT NOT NULL,
    wrong_answers INT NOT NULL,
    marks_obtained INT NOT NULL,
    total_marks INT NOT NULL,
    percentage NUMERIC NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'Draft', -- 'Draft', 'Pass', 'Fail'
    is_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    camera_violations INT NOT NULL DEFAULT 0,
    microphone_violations INT NOT NULL DEFAULT 0,
    fullscreen_violations INT NOT NULL DEFAULT 0,
    tab_switching_count INT NOT NULL DEFAULT 0,
    total_violations INT NOT NULL DEFAULT 0,
    violation_log JSONB NOT NULL DEFAULT '[]'::jsonb,
    camera_captures JSONB NOT NULL DEFAULT '[]'::jsonb,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policies for Public Access
-- Policy for public.students
DROP POLICY IF EXISTS "Allow public insert on students" ON public.students;
CREATE POLICY "Allow public insert on students" ON public.students 
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on students" ON public.students;
CREATE POLICY "Allow public select on students" ON public.students 
    FOR SELECT TO anon, authenticated USING (true);

-- Policy for public.exams
DROP POLICY IF EXISTS "Allow public select on exams" ON public.exams;
CREATE POLICY "Allow public select on exams" ON public.exams 
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on exams" ON public.exams;
CREATE POLICY "Allow public insert on exams" ON public.exams 
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on exams" ON public.exams;
CREATE POLICY "Allow public delete on exams" ON public.exams 
    FOR DELETE TO anon, authenticated USING (true);

-- Policy for public.results
DROP POLICY IF EXISTS "Allow public insert on results" ON public.results;
CREATE POLICY "Allow public insert on results" ON public.results 
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on results" ON public.results;
CREATE POLICY "Allow public update on results" ON public.results 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on results" ON public.results;
CREATE POLICY "Allow public select on results" ON public.results 
    FOR SELECT TO anon, authenticated USING (true);

-- =====================================================================
-- MIGRATION NOTE: If you already have an existing students table,
-- run only this ALTER to add the branch column without dropping data:
-- ALTER TABLE public.students ADD COLUMN IF NOT EXISTS branch VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE public.results ADD COLUMN IF NOT EXISTS branch VARCHAR NOT NULL DEFAULT '';
-- =====================================================================
