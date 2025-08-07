-- Create WebRTC signaling tables for live video streaming
-- This enables free peer-to-peer video streaming between students and teachers

-- Table to store WebRTC offers and answers
CREATE TABLE IF NOT EXISTS public.webrtc_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  offer_data JSONB NOT NULL,
  answer_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Table to store ICE candidates for WebRTC connection
CREATE TABLE IF NOT EXISTS public.webrtc_ice_candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  candidate_data JSONB NOT NULL,
  direction TEXT DEFAULT 'student_to_teacher' CHECK (direction IN ('student_to_teacher', 'teacher_to_student')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webrtc_offers_session_id ON public.webrtc_offers(session_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_offers_student_id ON public.webrtc_offers(student_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_offers_status ON public.webrtc_offers(status);
CREATE INDEX IF NOT EXISTS idx_webrtc_ice_candidates_session_id ON public.webrtc_ice_candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_ice_candidates_student_id ON public.webrtc_ice_candidates(student_id);

-- Enable RLS on WebRTC tables
ALTER TABLE public.webrtc_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_ice_candidates ENABLE ROW LEVEL SECURITY;

-- RLS policies for WebRTC offers
DROP POLICY IF EXISTS "Allow teachers and students to manage WebRTC offers" ON public.webrtc_offers;
CREATE POLICY "Allow teachers and students to manage WebRTC offers" ON public.webrtc_offers FOR ALL USING (true);

-- RLS policies for ICE candidates
DROP POLICY IF EXISTS "Allow teachers and students to manage ICE candidates" ON public.webrtc_ice_candidates;
CREATE POLICY "Allow teachers and students to manage ICE candidates" ON public.webrtc_ice_candidates FOR ALL USING (true);

-- Trigger for updated_at on webrtc_offers
DROP TRIGGER IF EXISTS handle_webrtc_offers_updated_at ON public.webrtc_offers;
CREATE TRIGGER handle_webrtc_offers_updated_at
  BEFORE UPDATE ON public.webrtc_offers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions
GRANT ALL ON public.webrtc_offers TO anon, authenticated;
GRANT ALL ON public.webrtc_ice_candidates TO anon, authenticated;

-- Clean up old WebRTC data (older than 1 day)
CREATE OR REPLACE FUNCTION public.cleanup_webrtc_data()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webrtc_ice_candidates WHERE created_at < NOW() - INTERVAL '1 day';
  DELETE FROM public.webrtc_offers WHERE created_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

SELECT 'WebRTC tables created successfully! Live video streaming is now available.' as status;