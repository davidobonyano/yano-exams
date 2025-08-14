-- Add email system for automated result delivery

-- Add email fields to students table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' 
                   AND column_name = 'email') THEN
        ALTER TABLE students ADD COLUMN email VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' 
                   AND column_name = 'parent_email') THEN
        ALTER TABLE students ADD COLUMN parent_email VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' 
                   AND column_name = 'parent_name') THEN
        ALTER TABLE students ADD COLUMN parent_name VARCHAR(255);
    END IF;
END $$;

-- Add email fields to teacher_students table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teacher_students' 
                   AND column_name = 'email') THEN
        ALTER TABLE teacher_students ADD COLUMN email VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teacher_students' 
                   AND column_name = 'parent_email') THEN
        ALTER TABLE teacher_students ADD COLUMN parent_email VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teacher_students' 
                   AND column_name = 'parent_name') THEN
        ALTER TABLE teacher_students ADD COLUMN parent_name VARCHAR(255);
    END IF;
END $$;

-- Add email settings to exam_sessions table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'exam_sessions' 
                   AND column_name = 'auto_email_results') THEN
        ALTER TABLE exam_sessions ADD COLUMN auto_email_results BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'exam_sessions' 
                   AND column_name = 'email_delay_days') THEN
        ALTER TABLE exam_sessions ADD COLUMN email_delay_days INTEGER DEFAULT 3;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'exam_sessions' 
                   AND column_name = 'email_to_parents') THEN
        ALTER TABLE exam_sessions ADD COLUMN email_to_parents BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'exam_sessions' 
                   AND column_name = 'email_to_students') THEN
        ALTER TABLE exam_sessions ADD COLUMN email_to_students BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create email queue table
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.student_exam_attempts(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_type VARCHAR(20) CHECK (recipient_type IN ('student', 'parent')) NOT NULL,
  email_subject VARCHAR(500) NOT NULL,
  email_body TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for email queue
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue (scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_email_queue_attempt ON email_queue (attempt_id);

-- Create email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) UNIQUE NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  template_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default email templates
INSERT INTO public.email_templates (template_name, subject_template, body_template, template_type)
VALUES 
('student_results', 
 'Your {{exam_title}} Results - {{student_name}}',
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .result-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .score { font-size: 24px; font-weight: bold; color: {{score_color}}; }
        .pass-status { padding: 10px; border-radius: 5px; margin: 10px 0; background: {{status_bg}}; color: {{status_color}}; }
        .questions { margin-top: 20px; }
        .question { margin: 15px 0; padding: 15px; background: white; border-radius: 5px; }
        .correct { border-left: 4px solid #10b981; }
        .incorrect { border-left: 4px solid #ef4444; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Exam Results</h1>
    </div>
    
    <div class="content">
        <h2>Dear {{student_name}},</h2>
        
        <p>Your results for <strong>{{exam_title}}</strong> are now available.</p>
        
        <div class="result-card">
            <div class="score">Score: {{percentage_score}}%</div>
            <div class="pass-status">{{pass_status_text}}</div>
            
            <p><strong>Exam Details:</strong></p>
            <ul>
                <li>Total Questions: {{total_questions}}</li>
                <li>Correct Answers: {{correct_answers}}</li>
                <li>Points Earned: {{points_earned}}/{{total_points}}</li>
                <li>Completion Date: {{completion_date}}</li>
            </ul>
        </div>
        
        {{#if include_questions}}
        <div class="questions">
            <h3>Question Review:</h3>
            {{#each questions}}
            <div class="question {{#if is_correct}}correct{{else}}incorrect{{/if}}">
                <p><strong>Q{{@index}}:</strong> {{question_text}}</p>
                <p><strong>Your Answer:</strong> {{student_answer}}</p>
                {{#unless is_correct}}
                <p><strong>Correct Answer:</strong> {{correct_answer}}</p>
                {{/unless}}
                {{#if explanation}}
                <p><strong>Explanation:</strong> {{explanation}}</p>
                {{/if}}
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <p>Keep up the great work!</p>
        
        <p>Best regards,<br>
        {{teacher_name}}<br>
        {{school_name}}</p>
    </div>
    
    <div class="footer">
        <p>This email was sent automatically from the Yano Exam System.</p>
    </div>
</body>
</html>',
 'student'
),
('parent_results',
 'Your Child''s Exam Results - {{student_name}} ({{exam_title}})',
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .result-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .score { font-size: 24px; font-weight: bold; color: {{score_color}}; }
        .pass-status { padding: 10px; border-radius: 5px; margin: 10px 0; background: {{status_bg}}; color: {{status_color}}; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Student Exam Results</h1>
    </div>
    
    <div class="content">
        <h2>Dear {{parent_name}},</h2>
        
        <p>We are pleased to share your child''s exam results for <strong>{{exam_title}}</strong>.</p>
        
        <div class="result-card">
            <p><strong>Student:</strong> {{student_name}}</p>
            <p><strong>Class:</strong> {{class_level}}</p>
            
            <div class="score">Score: {{percentage_score}}%</div>
            <div class="pass-status">{{pass_status_text}}</div>
            
            <p><strong>Performance Summary:</strong></p>
            <ul>
                <li>Total Questions: {{total_questions}}</li>
                <li>Correct Answers: {{correct_answers}}</li>
                <li>Points Earned: {{points_earned}} out of {{total_points}}</li>
                <li>Exam Date: {{completion_date}}</li>
                <li>Duration: {{duration_minutes}} minutes</li>
            </ul>
        </div>
        
        <p>{{#if passed}}
        Congratulations! Your child has successfully passed this exam.
        {{else}}
        Your child will benefit from additional practice in this subject area. Please feel free to reach out if you would like to discuss strategies for improvement.
        {{/if}}</p>
        
        <p>If you have any questions about these results, please don''t hesitate to contact me.</p>
        
        <p>Best regards,<br>
        {{teacher_name}}<br>
        {{school_name}}<br>
        {{teacher_email}}</p>
    </div>
    
    <div class="footer">
        <p>This email was sent automatically from the Yano Exam System.</p>
        <p>Please do not reply to this email. For inquiries, contact your child''s teacher directly.</p>
    </div>
</body>
</html>',
 'parent'
) ON CONFLICT (template_name) DO NOTHING;

SELECT 'Email system tables and templates created successfully!' as status;
