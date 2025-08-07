-- Manual Teacher Setup (if /admin registration doesn't work)
-- Run this FIRST, then run test-data-fixed.sql

-- Step 1: Create auth user
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'teacher@test.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Test Teacher"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- Step 2: Create teacher profile
INSERT INTO public.teachers (id, full_name, email, school_name)
SELECT 
    au.id,
    'Test Teacher',
    'teacher@test.com',
    'Demo Secondary School'
FROM auth.users au 
WHERE au.email = 'teacher@test.com';

-- Verify creation
SELECT 
    au.email,
    t.full_name,
    t.school_name,
    'Teacher created successfully!' as status
FROM auth.users au
JOIN public.teachers t ON t.id = au.id
WHERE au.email = 'teacher@test.com';