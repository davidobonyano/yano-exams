-- New Student Management System with Year-Based IDs and Centralized Admin Control
-- This replaces the problematic school profiles system with a clean, year-based approach

-- Drop existing problematic functions and tables
DROP FUNCTION IF EXISTS public.generate_student_id CASCADE;
DROP FUNCTION IF EXISTS public.add_student_to_class CASCADE;
DROP FUNCTION IF EXISTS public.generate_class_student_id CASCADE;
DROP TABLE IF EXISTS public.teacher_student_sequences CASCADE;
DROP TABLE IF EXISTS public.class_student_sequences CASCADE;

-- Create new centralized student management system
CREATE TABLE IF NOT EXISTS public.school_classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_level class_level NOT NULL,
  section CHAR(1) NOT NULL CHECK (section IN ('A', 'B', 'C', 'D', 'E')),
  academic_year INTEGER NOT NULL, -- e.g., 2024, 2025, etc.
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  max_students INTEGER DEFAULT 40,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(class_level, section, academic_year) -- Prevent duplicate class sections
);

-- Create centralized students table (replaces teacher_students)
CREATE TABLE IF NOT EXISTS public.central_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE, -- Format: YEAR/CLASS/SECTION/NUMBER (e.g., 2024/JSS1/A/001)
  full_name TEXT NOT NULL,
  class_id UUID REFERENCES public.school_classes(id) ON DELETE CASCADE NOT NULL,
  class_level class_level NOT NULL,
  section CHAR(1) NOT NULL CHECK (section IN ('A', 'B', 'C', 'D', 'E')),
  academic_year INTEGER NOT NULL,
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
  UNIQUE(full_name, class_level, section, academic_year) -- Prevent duplicate names in same class section
);

-- Create sequence table for year-based student numbering
CREATE TABLE IF NOT EXISTS public.student_sequences (
  class_level class_level NOT NULL,
  section CHAR(1) NOT NULL,
  academic_year INTEGER NOT NULL,
  next_number INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (class_level, section, academic_year)
);

-- Function to generate year-based student ID
CREATE OR REPLACE FUNCTION public.generate_year_based_student_id(
  p_class_level class_level,
  p_section CHAR(1),
  p_academic_year INTEGER
)
RETURNS TEXT AS $$
DECLARE
  v_next_number INTEGER;
  v_student_id TEXT;
BEGIN
  -- Get or create sequence record
  INSERT INTO public.student_sequences (class_level, section, academic_year, next_number)
  VALUES (p_class_level, p_section, p_academic_year, 1)
  ON CONFLICT (class_level, section, academic_year) 
  DO UPDATE SET 
    next_number = student_sequences.next_number + 1,
    updated_at = NOW()
  RETURNING next_number INTO v_next_number;

  -- Format: YEAR/CLASS/SECTION/NUMBER (e.g., 2024/JSS1/A/001)
  v_student_id := p_academic_year::TEXT || '/' || p_class_level || '/' || p_section || '/' || LPAD(v_next_number::TEXT, 3, '0');

  RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create or get school class
CREATE OR REPLACE FUNCTION public.create_or_get_school_class(
  p_class_level class_level,
  p_section CHAR(1),
  p_academic_year INTEGER,
  p_teacher_id UUID DEFAULT NULL,
  p_max_students INTEGER DEFAULT 40
)
RETURNS JSONB AS $$
DECLARE
  v_class_id UUID;
  v_existing_class school_classes%ROWTYPE;
BEGIN
  -- Check if class already exists
  SELECT * INTO v_existing_class
  FROM public.school_classes
  WHERE class_level = p_class_level 
  AND section = p_section 
  AND academic_year = p_academic_year;

  IF FOUND THEN
    -- Update teacher if provided
    IF p_teacher_id IS NOT NULL THEN
      UPDATE public.school_classes
      SET teacher_id = p_teacher_id,
          updated_at = NOW()
      WHERE id = v_existing_class.id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'class_id', v_existing_class.id,
      'message', 'Class already exists'
    );
  ELSE
    -- Create new class
    INSERT INTO public.school_classes (
      class_level, section, academic_year, teacher_id, max_students
    ) VALUES (
      p_class_level, p_section, p_academic_year, p_teacher_id, p_max_students
    ) RETURNING id INTO v_class_id;

    RETURN jsonb_build_object(
      'success', true,
      'class_id', v_class_id,
      'message', 'New class created'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add student to centralized system
CREATE OR REPLACE FUNCTION public.add_centralized_student(
  p_full_name TEXT,
  p_class_level class_level,
  p_section CHAR(1),
  p_academic_year INTEGER,
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
  v_class_id UUID;
  v_student_id TEXT;
  v_new_student central_students%ROWTYPE;
  v_class_result JSONB;
BEGIN
  -- Create or get the class first
  v_class_result := public.create_or_get_school_class(
    p_class_level, p_section, p_academic_year, p_teacher_id
  );
  
  IF NOT (v_class_result->>'success')::BOOLEAN THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to create/get class');
  END IF;
  
  v_class_id := (v_class_result->>'class_id')::UUID;

  -- Generate student ID
  v_student_id := public.generate_year_based_student_id(p_class_level, p_section, p_academic_year);

  -- Insert student
  INSERT INTO public.central_students (
    student_id,
    full_name,
    class_id,
    class_level,
    section,
    academic_year,
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
    v_class_id,
    p_class_level,
    p_section,
    p_academic_year,
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
      'error', 'Student with this name already exists in this class section'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all students for admin dashboard
CREATE OR REPLACE FUNCTION public.get_all_students_for_admin(
  p_academic_year INTEGER DEFAULT NULL,
  p_class_level class_level DEFAULT NULL,
  p_section CHAR(1) DEFAULT NULL
)
RETURNS TABLE (
  student_id TEXT,
  full_name TEXT,
  class_level class_level,
  section CHAR(1),
  academic_year INTEGER,
  school_name TEXT,
  teacher_name TEXT,
  admission_date DATE,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.student_id,
    cs.full_name,
    cs.class_level,
    cs.section,
    cs.academic_year,
    cs.school_name,
    t.full_name as teacher_name,
    cs.admission_date,
    cs.is_active
  FROM public.central_students cs
  LEFT JOIN public.school_classes sc ON cs.class_id = sc.id
  LEFT JOIN public.teachers t ON sc.teacher_id = t.id
  WHERE (p_academic_year IS NULL OR cs.academic_year = p_academic_year)
  AND (p_class_level IS NULL OR cs.class_level = p_class_level)
  AND (p_section IS NULL OR cs.section = p_section)
  ORDER BY cs.academic_year DESC, cs.class_level, cs.section, cs.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get students by teacher
CREATE OR REPLACE FUNCTION public.get_students_by_teacher(p_teacher_id UUID)
RETURNS TABLE (
  student_id TEXT,
  full_name TEXT,
  class_level class_level,
  section CHAR(1),
  academic_year INTEGER,
  school_name TEXT,
  admission_date DATE,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.student_id,
    cs.full_name,
    cs.class_level,
    cs.section,
    cs.academic_year,
    cs.school_name,
    cs.admission_date,
    cs.is_active
  FROM public.central_students cs
  JOIN public.school_classes sc ON cs.class_id = sc.id
  WHERE sc.teacher_id = p_teacher_id
  ORDER BY cs.academic_year DESC, cs.class_level, cs.section, cs.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get class statistics
CREATE OR REPLACE FUNCTION public.get_class_statistics()
RETURNS TABLE (
  class_level class_level,
  section CHAR(1),
  academic_year INTEGER,
  total_students BIGINT,
  active_students BIGINT,
  teacher_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.class_level,
    sc.section,
    sc.academic_year,
    COUNT(cs.id) as total_students,
    COUNT(cs.id) FILTER (WHERE cs.is_active = true) as active_students,
    t.full_name as teacher_name
  FROM public.school_classes sc
  LEFT JOIN public.central_students cs ON sc.id = cs.class_id
  LEFT JOIN public.teachers t ON sc.teacher_id = t.id
  GROUP BY sc.class_level, sc.section, sc.academic_year, t.full_name
  ORDER BY sc.academic_year DESC, sc.class_level, sc.section;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_central_students_class_id ON public.central_students(class_id);
CREATE INDEX IF NOT EXISTS idx_central_students_class_level ON public.central_students(class_level);
CREATE INDEX IF NOT EXISTS idx_central_students_academic_year ON public.central_students(academic_year);
CREATE INDEX IF NOT EXISTS idx_central_students_active ON public.central_students(is_active);
CREATE INDEX IF NOT EXISTS idx_school_classes_teacher ON public.school_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_school_classes_active ON public.school_classes(is_active);

-- Enable RLS on new tables
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for school_classes
DROP POLICY IF EXISTS "Teachers can view assigned classes" ON public.school_classes;
CREATE POLICY "Teachers can view assigned classes" ON public.school_classes
  FOR SELECT USING (teacher_id = auth.uid() OR auth.uid() IN (
    SELECT id FROM public.teachers WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Teachers can manage assigned classes" ON public.school_classes;
CREATE POLICY "Teachers can manage assigned classes" ON public.school_classes
  FOR ALL USING (teacher_id = auth.uid() OR auth.uid() IN (
    SELECT id FROM public.teachers WHERE id = auth.uid()
  ));

-- RLS Policies for central_students
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.central_students;
CREATE POLICY "Teachers can view students in their classes" ON public.central_students
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM public.school_classes WHERE teacher_id = auth.uid()
    ) OR auth.uid() IN (
      SELECT id FROM public.teachers WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can manage students in their classes" ON public.central_students;
CREATE POLICY "Teachers can manage students in their classes" ON public.central_students
  FOR ALL USING (
    class_id IN (
      SELECT id FROM public.school_classes WHERE teacher_id = auth.uid()
    ) OR auth.uid() IN (
      SELECT id FROM public.teachers WHERE id = auth.uid()
    )
  );

-- RLS Policies for student_sequences
DROP POLICY IF EXISTS "Allow all access to sequences" ON public.student_sequences;
CREATE POLICY "Allow all access to sequences" ON public.student_sequences FOR ALL USING (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_year_based_student_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_school_class TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_centralized_student TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_students_for_admin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_by_teacher TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_statistics TO anon, authenticated;

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_school_classes_updated_at ON public.school_classes;
CREATE TRIGGER handle_school_classes_updated_at
  BEFORE UPDATE ON public.school_classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_central_students_updated_at ON public.central_students;
CREATE TRIGGER handle_central_students_updated_at
  BEFORE UPDATE ON public.central_students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert default classes for the last 6 years (2019-2024) with sections A-E
DO $$
DECLARE
  year_val INTEGER;
  class_val class_level;
  section_val CHAR(1);
  class_levels class_level[] := ARRAY['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
  sections CHAR(1)[] := ARRAY['A', 'B', 'C', 'D', 'E'];
BEGIN
  -- Create classes for the last 6 years
  FOR year_val IN 2019..2024 LOOP
    FOREACH class_val IN ARRAY class_levels LOOP
      FOREACH section_val IN ARRAY sections LOOP
        INSERT INTO public.school_classes (class_level, section, academic_year, max_students)
        VALUES (class_val, section_val, year_val, 40)
        ON CONFLICT (class_level, section, academic_year) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Create sample students for testing (2024 academic year)
DO $$
DECLARE
  class_id UUID;
  student_id TEXT;
BEGIN
  -- Get JSS1A class for 2024
  SELECT id INTO class_id FROM public.school_classes 
  WHERE class_level = 'JSS1' AND section = 'A' AND academic_year = 2024;
  
  IF class_id IS NOT NULL THEN
    -- Add sample students
    PERFORM public.add_centralized_student(
      'Alice Johnson',
      'JSS1',
      'A',
      2024,
      'Demo Secondary School',
      (SELECT id FROM public.teachers LIMIT 1),
      'alice@demo.com',
      '08012345678',
      'Mr. Johnson',
      '08087654321'
    );
    
    PERFORM public.add_centralized_student(
      'Bob Smith',
      'JSS1',
      'A',
      2024,
      'Demo Secondary School',
      (SELECT id FROM public.teachers LIMIT 1),
      'bob@demo.com',
      '08023456789',
      'Mrs. Smith',
      '08076543210'
    );
    
    PERFORM public.add_centralized_student(
      'Carol Brown',
      'JSS1',
      'A',
      2024,
      'Demo Secondary School',
      (SELECT id FROM public.teachers LIMIT 1),
      'carol@demo.com',
      '08034567890',
      'Mr. Brown',
      '08065432109'
    );
  END IF;
END $$;

SELECT 'New centralized student management system installed successfully!' as status;
SELECT 'Features:' as feature;
SELECT '- Year-based student IDs (e.g., 2024/JSS1/A/001)' as feature;
SELECT '- Sections A-E for each class level' as feature;
SELECT '- Centralized admin dashboard to prevent duplicates' as feature;
SELECT '- Support for last 6 years (2019-2024)' as feature;
SELECT '- Automatic class creation and student numbering' as feature;
