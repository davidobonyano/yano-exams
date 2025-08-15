// Gmail-based email service for automated result delivery
import nodemailer from 'nodemailer';
import { supabase } from './supabase';

// Create Gmail transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SCHOOL_GMAIL_USER, // e.g., admin@yourschool.edu
      pass: process.env.SCHOOL_GMAIL_APP_PASSWORD, // Gmail app password
    },
  });
};

interface EmailTemplate {
  subject_template: string;
  body_template: string;
}

interface EmailData {
  student_name: string;
  exam_title: string;
  percentage_score: number;
  total_questions: number;
  correct_answers: number;
  points_earned: number;
  total_points: number;
  passed: boolean;
  completion_date: string;
  duration_minutes: number;
  class_level: string;
  parent_name: string;
  teacher_name: string;
  teacher_email: string;
  school_name: string;
  questions?: Array<{
    question_text: string;
    student_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation?: string;
  }>;
}

// Template engine for simple variable replacement
function processTemplate(template: string, data: EmailData): string {
  let processed = template;
  
  // Replace simple variables
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, String(value));
  });
  
  // Add computed values
  const scoreColor = data.passed ? '#10b981' : '#ef4444';
  const statusBg = data.passed ? '#d1fae5' : '#fee2e2';
  const statusColor = data.passed ? '#065f46' : '#991b1b';
  const passStatusText = data.passed ? 
    `🎉 Congratulations! You passed with ${data.percentage_score}%` : 
    `Keep trying! You scored ${data.percentage_score}%. Continue studying to improve.`;
  
  processed = processed.replace(/{{score_color}}/g, scoreColor);
  processed = processed.replace(/{{status_bg}}/g, statusBg);
  processed = processed.replace(/{{status_color}}/g, statusColor);
  processed = processed.replace(/{{pass_status_text}}/g, passStatusText);
  
  // Handle questions section
  if (data.questions && data.questions.length > 0) {
    processed = processed.replace(/{{#if include_questions}}[\s\S]*?{{\/if}}/g, (match) => {
      return match.replace(/{{#if include_questions}}|{{\/if}}/g, '');
    });
    
    // Replace questions loop
    const questionsHtml = data.questions.map((q, index) => `
      <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 5px; border-left: 4px solid ${q.is_correct ? '#10b981' : '#ef4444'};">
        <p><strong>Q${index + 1}:</strong> ${q.question_text}</p>
        <p><strong>Your Answer:</strong> ${q.student_answer}</p>
        ${!q.is_correct ? `<p><strong>Correct Answer:</strong> ${q.correct_answer}</p>` : ''}
        ${q.explanation ? `<p><strong>Explanation:</strong> ${q.explanation}</p>` : ''}
      </div>
    `).join('');
    
    processed = processed.replace(/{{#each questions}}[\s\S]*?{{\/each}}/g, questionsHtml);
  } else {
    // Remove questions section if no questions
    processed = processed.replace(/{{#if include_questions}}[\s\S]*?{{\/if}}/g, '');
  }
  
  return processed;
}

// Get email template from database
async function getEmailTemplate(templateName: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('subject_template, body_template')
    .eq('template_name', templateName)
    .single();
  
  if (error) {
    console.error('Error fetching email template:', error);
    return null;
  }
  
  return data;
}

// Get detailed result data for email
async function getEmailData(attemptId: string): Promise<EmailData | null> {
  const { data, error } = await supabase.rpc('get_detailed_student_results', {
    p_attempt_id: attemptId
  });
  
  if (error || !data?.success) {
    console.error('Error fetching result data:', error);
    return null;
  }
  
  const attempt = data.attempt_info;
  const questions = data.detailed_answers;
  
  return {
    student_name: attempt.student_name,
    exam_title: attempt.exam_title,
    percentage_score: attempt.percentage_score,
    total_questions: attempt.total_questions,
    correct_answers: attempt.correct_answers,
    points_earned: attempt.points_earned,
    total_points: attempt.total_points,
    passed: attempt.passed,
    completion_date: new Date(attempt.completed_at).toLocaleDateString(),
    duration_minutes: attempt.duration_minutes || 0,
    class_level: attempt.student_class_level || '',
    parent_name: 'Parent/Guardian',
    teacher_name: attempt.teacher_name || 'Teacher',
    teacher_email: process.env.SCHOOL_GMAIL_USER || '',
    school_name: process.env.SCHOOL_NAME || 'School',
    questions: questions?.map((q: { question_text: string; student_answer_text?: string; correct_answer_text: string; is_correct: boolean; explanation?: string }) => ({
      question_text: q.question_text,
      student_answer: q.student_answer_text || 'Not answered',
      correct_answer: q.correct_answer_text,
      is_correct: q.is_correct,
      explanation: q.explanation
    }))
  };
}

// Process and send a single email using Gmail
export async function processEmailWithGmail(emailId: string): Promise<boolean> {
  try {
    // Get email details
    const { data: emailQueue, error: emailError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', emailId)
      .single();
    
    if (emailError || !emailQueue) {
      console.error('Email not found:', emailError);
      return false;
    }
    
    // Get email data
    const emailData = await getEmailData(emailQueue.attempt_id);
    if (!emailData) {
      await supabase.rpc('mark_email_failed', {
        p_email_id: emailId,
        p_error_message: 'Failed to fetch email data'
      });
      return false;
    }
    
    // Process template if it starts with "TEMPLATE:"
    let subject = emailQueue.email_subject;
    let body = emailQueue.email_body;
    
    if (body.startsWith('TEMPLATE:')) {
      const templateName = body.replace('TEMPLATE:', '');
      const template = await getEmailTemplate(templateName);
      
      if (!template) {
        await supabase.rpc('mark_email_failed', {
          p_email_id: emailId,
          p_error_message: 'Email template not found'
        });
        return false;
      }
      
      subject = processTemplate(template.subject_template, emailData);
      body = processTemplate(template.body_template, emailData);
    }
    
    // Create Gmail transporter
    const transporter = createTransporter();
    
    // Send email
    const mailOptions = {
      from: `${process.env.SCHOOL_NAME || 'School'} <${process.env.SCHOOL_GMAIL_USER}>`,
      to: emailQueue.recipient_email,
      subject: subject,
      html: body,
      replyTo: process.env.SCHOOL_GMAIL_USER, // Parents can reply directly to school
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    // Mark as sent
    await supabase.rpc('mark_email_sent', {
      p_email_id: emailId
    });
    
    console.log('Email sent successfully via Gmail:', result.messageId);
    return true;
    
  } catch (error) {
    console.error('Error processing email with Gmail:', error);
    await supabase.rpc('mark_email_failed', {
      p_email_id: emailId,
      p_error_message: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

// Process all pending emails using Gmail
export async function processPendingEmailsWithGmail(): Promise<number> {
  try {
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails', {
      p_limit: 50
    });
    
    if (error || !pendingEmails) {
      console.error('Error fetching pending emails:', error);
      return 0;
    }
    
    let sentCount = 0;
    
    for (const email of pendingEmails) {
      const success = await processEmailWithGmail(email.email_id);
      if (success) {
        sentCount++;
      }
      
      // Add delay between emails to avoid Gmail rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }
    
    return sentCount;
    
  } catch (error) {
    console.error('Error processing pending emails with Gmail:', error);
    return 0;
  }
}
