-- Neon PostgreSQL Schema for Smart Exam Portal
-- Run this in your Neon SQL Editor

-- Drop existing tables (clean start)
DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;

-- 1. Students Table
CREATE TABLE public.students (
    roll_number VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    password VARCHAR NOT NULL,
    branch VARCHAR NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Exams Table
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
    resume_window INT NOT NULL DEFAULT 60,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Results Table
CREATE TABLE public.results (
    id VARCHAR PRIMARY KEY,
    exam_id VARCHAR NOT NULL,
    exam_name VARCHAR NOT NULL,
    student_name VARCHAR NOT NULL,
    roll_number VARCHAR NOT NULL,
    branch VARCHAR NOT NULL DEFAULT '',
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
    status VARCHAR NOT NULL DEFAULT 'Draft',
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

-- Indexes for performance with 300+ students
CREATE INDEX idx_results_roll_number ON public.results(roll_number);
CREATE INDEX idx_results_exam_id ON public.results(exam_id);
CREATE INDEX idx_results_is_submitted ON public.results(is_submitted);
CREATE INDEX idx_students_roll_number ON public.students(roll_number);
