-- Simple School Student Management System
-- YAN/number format for unique student IDs across all classes

-- Drop existing problematic functions and tables
DROP FUNCTION IF EXISTS public.generate_student_id CASCADE;
DROP FUNCTION IF EXISTS public.add_student_to_class CASCADE;
DROP FUNCTION IF EXISTS public.generate_class_student_id CASCADE;
DROP FUNCTION IF EXISTS public.add_centralized_student CASCADE;
DROP TABLE IF EXISTS public.teacher_student_sequences CASCADE;
DROP TABLE IF EXISTS public.class_student_sequences CASCADE;
DROP TABLE IF EXISTS public.student_sequences CASCADE;
DROP TABLE IF EXISTS public.school_classes CASCADE;
DROP TABLE IF EXISTS public.central_students CASCADE;

-- Create simple school students table
CREATE TABLE IF NOT EXISTS public.school_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE, -- Format: YAN001, YAN002, etc.
  full_name TEXT NOT NULL,
  class_level class_level NOT NULL,
  school_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(full_name, class_level) -- Prevent duplicate names in same class
);

-- Create sequence for student ID generation
CREATE TABLE IF NOT EXISTS public.student_id_sequence (
  id SERIAL PRIMARY KEY,
  next_number INTEGER DEFAULT 1,
  school_code TEXT DEFAULT 'YAN',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insert initial sequence record
INSERT INTO public.student_id_sequence (next_number, school_code) VALUES (1, 'YAN')
ON CONFLICT DO NOTHING;

-- Function to generate YAN student ID
CREATE OR REPLACE FUNCTION public.generate_yan_student_id()
RETURNS TEXT AS $$
DECLARE
  v_next_number INTEGER;
  v_student_id TEXT;
  v_sequence_record student_id_sequence%ROWTYPE;
BEGIN
  -- Get sequence record
  SELECT * INTO v_sequence_record FROM public.student_id_sequence LIMIT 1;
  
  v_next_number := v_sequence_record.next_number;
  v_student_id := v_sequence_record.school_code || LPAD(v_next_number::TEXT, 3, '0');

  -- Update sequence
  UPDATE public.student_id_sequence
  SET next_number = next_number + 1,
      updated_at = NOW()
  WHERE id = v_sequence_record.id;

  RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add student to school
CREATE OR REPLACE FUNCTION public.add_school_student(
  p_full_name TEXT,
  p_class_level class_level,
  p_school_name TEXT,
  p_teacher_id UUID,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_parent_name TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  p_admission_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_student_id TEXT;
  v_new_student school_students%ROWTYPE;
BEGIN
  -- Generate student ID
  v_student_id := public.generate_yan_student_id();

  -- Insert student
  INSERT INTO public.school_students (
    student_id,
    full_name,
    class_level,
    school_name,
    email,
    phone,
    parent_name,
    parent_phone,
    admission_date,
    created_by
  ) VALUES (
    v_student_id,
    p_full_name,
    p_class_level,
    p_school_name,
    p_email,
    p_phone,
    p_parent_name,
    p_parent_phone,
    p_admission_date,
    p_teacher_id
  ) RETURNING * INTO v_new_student;

  RETURN jsonb_build_object(
    'success', true,
    'student', row_to_json(v_new_student),
    'student_id', v_student_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student with this name already exists in this class'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all students for admin dashboard
CREATE OR REPLACE FUNCTION public.get_all_school_students(
  p_class_level class_level DEFAULT NULL
)
RETURNS TABLE (
  student_id TEXT,
  full_name TEXT,
  class_level class_level,
  school_name TEXT,
  email TEXT,
  phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  admission_date DATE,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.student_id,
    ss.full_name,
    ss.class_level,
    ss.school_name,
    ss.email,
    ss.phone,
    ss.parent_name,
    ss.parent_phone,
    ss.admission_date,
    ss.is_active
  FROM public.school_students ss
  WHERE (p_class_level IS NULL OR ss.class_level = p_class_level)
  ORDER BY ss.student_id, ss.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get students by teacher
CREATE OR REPLACE FUNCTION public.get_students_by_teacher(p_teacher_id UUID)
RETURNS TABLE (
  student_id TEXT,
  full_name TEXT,
  class_level class_level,
  school_name TEXT,
  admission_date DATE,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.student_id,
    ss.full_name,
    ss.class_level,
    ss.school_name,
    ss.admission_date,
    ss.is_active
  FROM public.school_students ss
  WHERE ss.created_by = p_teacher_id
  ORDER BY ss.student_id, ss.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get class statistics
CREATE OR REPLACE FUNCTION public.get_school_class_statistics()
RETURNS TABLE (
  class_level class_level,
  total_students BIGINT,
  active_students BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.class_level,
    COUNT(ss.id) as total_students,
    COUNT(ss.id) FILTER (WHERE ss.is_active = true) as active_students
  FROM public.school_students ss
  GROUP BY ss.class_level
  ORDER BY ss.class_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update school code
CREATE OR REPLACE FUNCTION public.update_school_code(p_new_school_code TEXT)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.student_id_sequence
  SET school_code = p_new_school_code,
      updated_at = NOW();
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'School code updated to ' || p_new_school_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next student number
CREATE OR REPLACE FUNCTION public.get_next_student_number()
RETURNS INTEGER AS $$
DECLARE
  v_next_number INTEGER;
BEGIN
  SELECT next_number INTO v_next_number 
  FROM public.student_id_sequence 
  LIMIT 1;
  
  RETURN v_next_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_students_student_id ON public.school_students(student_id);
CREATE INDEX IF NOT EXISTS idx_school_students_class_level ON public.school_students(class_level);
CREATE INDEX IF NOT EXISTS idx_school_students_active ON public.school_students(is_active);
CREATE INDEX IF NOT EXISTS idx_school_students_created_by ON public.school_students(created_by);

-- Enable RLS on new tables
ALTER TABLE public.school_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_id_sequence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for school_students
DROP POLICY IF EXISTS "Teachers can view all students" ON public.school_students;
CREATE POLICY "Teachers can view all students" ON public.school_students
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM public.teachers WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Teachers can manage students" ON public.school_students;
CREATE POLICY "Teachers can manage students" ON public.school_students
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM public.teachers WHERE id = auth.uid()
  ));

-- RLS Policies for student_id_sequence
DROP POLICY IF EXISTS "Allow all access to sequence" ON public.student_id_sequence;
CREATE POLICY "Allow all access to sequence" ON public.student_id_sequence FOR ALL USING (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_yan_student_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_school_student TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_school_students TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_by_teacher TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_class_statistics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_school_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_student_number TO anon, authenticated;

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_school_students_updated_at ON public.school_students;
CREATE TRIGGER handle_school_students_updated_at
  BEFORE UPDATE ON public.school_students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create sample students for testing
DO $$
DECLARE
  teacher_id UUID;
BEGIN
  -- Get first teacher
  SELECT id INTO teacher_id FROM public.teachers LIMIT 1;
  
  IF teacher_id IS NOT NULL THEN
    -- Add sample students (order will be YAN001, YAN002, YAN003, YAN004)
    PERFORM public.add_school_student(
      'Alice Johnson',
      'JSS1',
      'Demo Secondary School',
      teacher_id,
      'alice@demo.com',
      '08012345678',
      'Mr. Johnson',
      '08087654321'
    );
    
    PERFORM public.add_school_student(
      'Bob Smith',
      'SS1',
      'Demo Secondary School',
      teacher_id,
      'bob@demo.com',
      '08023456789',
      'Mrs. Smith',
      '08076543210'
    );
    
    PERFORM public.add_school_student(
      'Carol Brown',
      'JSS2',
      'Demo Secondary School',
      teacher_id,
      'carol@demo.com',
      '08034567890',
      'Mr. Brown',
      '08065432109'
    );
    
    PERFORM public.add_school_student(
      'David Wilson',
      'SS3',
      'Demo Secondary School',
      teacher_id,
      'david@demo.com',
      '08045678901',
      'Mrs. Wilson',
      '08054321098'
    );
  END IF;
END $$;

SELECT 'YAN School Student Management System installed successfully!' as status;
SELECT 'Features:' as feature;
SELECT '- YAN/number format (e.g., YAN001, YAN002, etc.)' as feature;
SELECT '- Unique numbers across all classes' as feature;
SELECT '- Order based on creation time' as feature;
SELECT '- Easy integration with school websites' as feature;
SELECT '- Clean and simple database structure' as feature;
