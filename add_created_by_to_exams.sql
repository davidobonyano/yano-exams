-- Add created_by column to exams table if it doesn't exist
-- This is needed for the AdminDashboard to properly fetch teacher's exams

DO $$ 
BEGIN
    -- Check if created_by column exists in exams table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exams' AND column_name = 'created_by'
    ) THEN
        -- Add created_by column
        ALTER TABLE public.exams 
        ADD COLUMN created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added created_by column to exams table';
    ELSE
        RAISE NOTICE 'created_by column already exists in exams table';
    END IF;
END $$;

-- Update existing exams to set created_by to the first teacher (if any exist)
UPDATE public.exams 
SET created_by = (SELECT id FROM public.teachers LIMIT 1)
WHERE created_by IS NULL 
AND EXISTS (SELECT 1 FROM public.teachers);

-- Status message
SELECT 'created_by column added to exams table successfully!' as status;
