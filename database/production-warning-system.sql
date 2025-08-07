-- Production-ready warning system with atomic operations
-- This script fixes the foreign key issues and creates production functions

-- First, fix the student_warnings table foreign key constraint
DO $$ 
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'student_warnings' 
        AND constraint_name = 'student_warnings_student_id_fkey'
    ) THEN
        ALTER TABLE public.student_warnings 
        DROP CONSTRAINT student_warnings_student_id_fkey;
    END IF;
    
    -- Add the correct foreign key constraint to reference students table
    ALTER TABLE public.student_warnings 
    ADD CONSTRAINT student_warnings_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed student_warnings foreign key constraint';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing foreign key: %', SQLERRM;
END $$;

-- Create atomic warning function for production use
CREATE OR REPLACE FUNCTION public.send_student_warning(
    p_attempt_id UUID,
    p_session_id UUID,
    p_student_id UUID,
    p_teacher_id UUID,
    p_message TEXT,
    p_severity TEXT DEFAULT 'medium'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_warning_id UUID;
    v_new_warning_count INTEGER;
    v_result jsonb;
BEGIN
    -- Validate severity
    IF p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid severity level'
        );
    END IF;

    -- Validate required parameters
    IF p_attempt_id IS NULL OR p_session_id IS NULL OR p_student_id IS NULL OR 
       p_teacher_id IS NULL OR p_message IS NULL OR trim(p_message) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Missing required parameters'
        );
    END IF;

    -- Insert warning and update count atomically in a transaction
    BEGIN
        -- Insert the warning
        INSERT INTO public.student_warnings (
            attempt_id,
            session_id,
            student_id,
            teacher_id,
            message,
            severity
        ) VALUES (
            p_attempt_id,
            p_session_id,
            p_student_id,
            p_teacher_id,
            p_message,
            p_severity
        ) RETURNING id INTO v_warning_id;

        -- Atomically increment warning count
        UPDATE public.student_exam_attempts
        SET 
            warning_count = COALESCE(warning_count, 0) + 1,
            last_activity_at = NOW()
        WHERE id = p_attempt_id
        RETURNING warning_count INTO v_new_warning_count;

        -- Check if update affected any rows
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Attempt ID not found: %', p_attempt_id;
        END IF;

        -- Return success response
        v_result := jsonb_build_object(
            'success', true,
            'warning_id', v_warning_id,
            'new_warning_count', v_new_warning_count,
            'message', 'Warning sent successfully'
        );

        RETURN v_result;

    EXCEPTION
        WHEN foreign_key_violation THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid student, session, or teacher ID'
            );
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Database error: ' || SQLERRM
            );
    END;
END;
$$;

-- Create function to get student warning history
CREATE OR REPLACE FUNCTION public.get_student_warning_history(
    p_student_id UUID,
    p_session_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    warning_id UUID,
    message TEXT,
    severity TEXT,
    sent_at TIMESTAMPTZ,
    acknowledged BOOLEAN,
    acknowledged_at TIMESTAMPTZ,
    teacher_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sw.id as warning_id,
        sw.message,
        sw.severity,
        sw.sent_at,
        sw.acknowledged,
        sw.acknowledged_at,
        t.full_name as teacher_name
    FROM public.student_warnings sw
    JOIN public.teachers t ON t.id = sw.teacher_id
    WHERE sw.student_id = p_student_id
    AND (p_session_id IS NULL OR sw.session_id = p_session_id)
    ORDER BY sw.sent_at DESC
    LIMIT p_limit;
END;
$$;

-- Create function to acknowledge a warning
CREATE OR REPLACE FUNCTION public.acknowledge_warning(
    p_warning_id UUID,
    p_student_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Update the warning to acknowledged
    UPDATE public.student_warnings
    SET 
        acknowledged = true,
        acknowledged_at = NOW()
    WHERE id = p_warning_id
    AND student_id = p_student_id
    AND acknowledged = false;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Warning not found or already acknowledged'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Warning acknowledged successfully'
    );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.send_student_warning TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_warning_history TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_warning TO anon, authenticated;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_warnings_student_session 
ON public.student_warnings(student_id, session_id);

CREATE INDEX IF NOT EXISTS idx_student_warnings_sent_at 
ON public.student_warnings(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_warnings_acknowledged 
ON public.student_warnings(acknowledged) WHERE acknowledged = false;

-- Add comment for documentation
COMMENT ON FUNCTION public.send_student_warning IS 'Atomically sends a warning to a student and increments their warning count';
COMMENT ON FUNCTION public.get_student_warning_history IS 'Retrieves warning history for a student';
COMMENT ON FUNCTION public.acknowledge_warning IS 'Allows a student to acknowledge a warning';

-- Log successful execution
DO $$
BEGIN
    RAISE NOTICE 'Production warning system setup completed successfully';
    RAISE NOTICE 'Functions created: send_student_warning, get_student_warning_history, acknowledge_warning';
    RAISE NOTICE 'Indexes created for optimal performance';
END $$;