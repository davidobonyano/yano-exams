-- Add new question types to the question_type enum
-- This script adds support for fill-in-the-gap and subjective questions

-- Add the new values to the enum if they don't exist
DO $$ 
BEGIN
    -- Add fill_in_gap if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'fill_in_gap' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'question_type')
    ) THEN
        ALTER TYPE question_type ADD VALUE 'fill_in_gap';
    END IF;
    
    -- Add subjective if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'subjective' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'question_type')
    ) THEN
        ALTER TYPE question_type ADD VALUE 'subjective';
    END IF;
    
    RAISE NOTICE 'Question types updated successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating question types: %', SQLERRM;
END $$;

-- Create a function to validate question types
CREATE OR REPLACE FUNCTION validate_question_type(p_question_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_question_type IN ('multiple_choice', 'true_false', 'short_answer', 'fill_in_gap', 'subjective');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the questions table to ensure proper constraints
ALTER TABLE public.questions 
ADD CONSTRAINT check_question_type 
CHECK (validate_question_type(question_type));

-- Create a function to get question type display name
CREATE OR REPLACE FUNCTION get_question_type_display(p_question_type TEXT)
RETURNS TEXT AS $$
BEGIN
    CASE p_question_type
        WHEN 'multiple_choice' THEN RETURN 'Multiple Choice';
        WHEN 'true_false' THEN RETURN 'True/False';
        WHEN 'short_answer' THEN RETURN 'Short Answer';
        WHEN 'fill_in_gap' THEN RETURN 'Fill in the Gap';
        WHEN 'subjective' THEN RETURN 'Subjective';
        ELSE RETURN 'Unknown';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_question_type TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_question_type_display TO anon, authenticated;

-- Show current question types
SELECT 'Current question types:' as info;
SELECT unnest(enum_range(NULL::question_type)) as question_type;

SELECT 'Question types updated successfully!' as status;
SELECT 'New types added:' as new_types;
SELECT '- fill_in_gap: Fill in the blank questions' as new_type;
SELECT '- subjective: Essay/long answer questions' as new_type;
