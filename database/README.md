# Database Setup Instructions

## Prerequisites
1. Create a Supabase account at https://supabase.com
2. Create a new project in Supabase
3. Get your project URL and API keys

## Setup Steps

### 1. Update Environment Variables
Copy your Supabase project details to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Run Database Migrations
1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `schema.sql`
4. Click "Run" to create all tables and policies

### 3. Seed Sample Data
1. In the SQL Editor, copy and paste the contents of `seed.sql`
2. Click "Run" to populate the database with sample classes, exams, and questions

### 4. Enable Authentication
1. Go to Authentication > Settings in your Supabase dashboard
2. Configure email authentication
3. Set up email templates as needed

## Database Structure

### Core Tables
- `users` - Extended user profiles with full name and class level
- `classes` - Nigerian standard classes (JSS1-3, SS1-3)
- `exams` - Exam definitions per class level
- `questions` - Individual questions for each exam
- `user_exam_attempts` - Tracks exam attempts (prevents retaking)
- `user_answers` - Student answers for each question
- `exam_results` - Final scores and results
- `cheating_logs` - Tracks potential cheating behaviors

### Security Features
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Students can only see exams for their class level
- Questions only visible during active exam attempts