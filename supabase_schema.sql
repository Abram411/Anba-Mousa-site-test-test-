-- ==============================================================================
-- Coptic Sunday School & Church Education Platform - Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create Profiles Table (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
  grade TEXT DEFAULT '4th Grade',
  avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=coptic_student',
  points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 1,
  longest_streak INTEGER DEFAULT 1,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  require_reward_approval BOOLEAN DEFAULT true,
  push_notifications_enabled BOOLEAN DEFAULT true,
  notify_lesson_completion BOOLEAN DEFAULT true,
  notify_event_reminders BOOLEAN DEFAULT true,
  screen_time_seconds INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile or parents can update children" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id OR auth.uid() = parent_id);

-- 2. Create Lessons Table (Curriculum, Quizzes & Multimedia References)
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bible', 'hymns', 'history', 'virtues')),
  grade_level TEXT NOT NULL,
  summary_en TEXT,
  summary_ar TEXT,
  scripture_verse_en TEXT,
  scripture_verse_ar TEXT,
  verse_reference TEXT,
  audio_url TEXT, -- Link to Supabase Storage hymn/reading
  pdf_worksheet_url TEXT, -- Link to Supabase Storage coloring sheet/PDF
  points_reward INTEGER DEFAULT 100,
  quiz_questions JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read lessons" 
  ON public.lessons FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Teachers and admins can manage lessons" 
  ON public.lessons FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND (profiles.role = 'teacher' OR profiles.role = 'admin')
    )
  );

-- 3. Create Lesson Completions / Progress Table
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  quiz_score INTEGER DEFAULT 0,
  verse_memorized BOOLEAN DEFAULT false,
  points_earned INTEGER DEFAULT 0,
  servant_feedback TEXT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(student_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and their parents can view progress" 
  ON public.lesson_progress FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = student_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = student_id AND profiles.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'admin'))
  );

CREATE POLICY "Students can update their progress" 
  ON public.lesson_progress FOR ALL 
  TO authenticated 
  USING (auth.uid() = student_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'admin')));

-- 4. Create Church Events & Liturgy Notifications Table
CREATE TABLE IF NOT EXISTS public.church_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('liturgy', 'sunday_school', 'parent_meeting', 'hymns', 'feast', 'service')),
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location_en TEXT,
  location_ar TEXT,
  description_en TEXT,
  description_ar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read church events" 
  ON public.church_events FOR SELECT 
  TO authenticated 
  USING (true);

-- 5. Create Reward Approval Requests Table
CREATE TABLE IF NOT EXISTS public.reward_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  reward_name_en TEXT NOT NULL,
  reward_name_ar TEXT NOT NULL,
  cost_points INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  parent_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  decided_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.reward_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reward requests access policy" 
  ON public.reward_requests FOR ALL 
  TO authenticated 
  USING (
    auth.uid() = student_id 
    OR auth.uid() = parent_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 6. Create User Relationships Table (Parent-Child and Guardian-Student Linking)
CREATE TABLE IF NOT EXISTS public.user_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_code TEXT,
  relationship_type TEXT DEFAULT 'parent_child' CHECK (relationship_type IN ('parent_child', 'guardian_student', 'teacher_student')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(parent_id, child_id)
);

ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own relationships" 
  ON public.user_relationships FOR SELECT 
  TO authenticated 
  USING (auth.uid() = parent_id OR auth.uid() = child_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher')));

CREATE POLICY "Parents can insert and manage child relationships" 
  ON public.user_relationships FOR ALL 
  TO authenticated 
  USING (auth.uid() = parent_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 7. Supabase Storage Buckets Setup Note:
-- Create three public buckets in Supabase Dashboard -> Storage:
-- 1) 'avatars' (for high-resolution student and servant profile photos)
-- 2) 'hymns-audio' (for MP3/M4A liturgical chant recordings)
-- 3) 'lesson-worksheets' (for Sunday School PDF coloring sheets and handouts)
