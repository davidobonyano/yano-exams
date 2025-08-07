-- Simple Teacher Creation for Testing
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    new_teacher_id UUID;
BEGIN
    -- Create the auth user
    INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data
    ) VALUES (
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'teacher@test.com',
        '$2a$10$1234567890123456789012345678901234567890123456', -- password123
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Test Teacher"}'
    ) RETURNING id INTO new_teacher_id;

    -- Create the teacher profile
    INSERT INTO public.teachers (id, full_name, email, school_name) VALUES (
        new_teacher_id,
        'Test Teacher',
        'teacher@test.com',
        'Demo Secondary School'
    );

    RAISE NOTICE '✅ Teacher created successfully!';
    RAISE NOTICE '📧 Email: teacher@test.com';
    RAISE NOTICE '🔑 Password: password123';
    RAISE NOTICE '🆔 Teacher ID: %', new_teacher_id;
    RAISE NOTICE '';
    RAISE NOTICE '👉 Now you can:';
    RAISE NOTICE '   1. Login at /admin with teacher@test.com / password123';
    RAISE NOTICE '   2. Run test-data-fixed.sql to create sample exams';
    
END $$;