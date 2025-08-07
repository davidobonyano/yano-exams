import { supabase } from './supabase'

interface EmailResultsData {
  studentName: string
  studentEmail: string
  examTitle: string
  score: number
  passed: boolean
  totalQuestions: number
  correctAnswers: number
  sessionCode: string
  submittedAt: string
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export function generateResultsEmailTemplate(data: EmailResultsData): EmailTemplate {
  const subject = `Exam Results: ${data.examTitle} - ${data.passed ? 'Passed' : 'Failed'}`
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exam Results</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .result-box { 
                background: white; 
                border-left: 5px solid ${data.passed ? '#10b981' : '#ef4444'}; 
                padding: 20px; 
                margin: 20px 0; 
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .score { font-size: 2em; font-weight: bold; color: ${data.passed ? '#10b981' : '#ef4444'}; }
            .status { 
                display: inline-block; 
                padding: 5px 15px; 
                border-radius: 20px; 
                color: white; 
                font-weight: bold;
                background: ${data.passed ? '#10b981' : '#ef4444'};
            }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Exam Results</h1>
            <p>Your exam has been graded and results are ready</p>
        </div>
        
        <div class="content">
            <p>Dear ${data.studentName},</p>
            
            <p>Your exam results for <strong>${data.examTitle}</strong> are now available.</p>
            
            <div class="result-box">
                <div style="text-align: center;">
                    <div class="score">${data.score.toFixed(1)}%</div>
                    <div style="margin: 10px 0;">
                        <span class="status">${data.passed ? '✅ PASSED' : '❌ FAILED'}</span>
                    </div>
                </div>
            </div>
            
            <div class="details">
                <h3>📋 Exam Details</h3>
                <ul>
                    <li><strong>Exam:</strong> ${data.examTitle}</li>
                    <li><strong>Session:</strong> ${data.sessionCode}</li>
                    <li><strong>Questions Answered:</strong> ${data.correctAnswers} out of ${data.totalQuestions}</li>
                    <li><strong>Submitted:</strong> ${new Date(data.submittedAt).toLocaleString()}</li>
                </ul>
            </div>
            
            ${data.passed ? `
                <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="color: #059669; margin: 0 0 10px 0;">🎉 Congratulations!</h3>
                    <p style="margin: 0;">You have successfully passed the exam. Great job on your preparation and performance!</p>
                </div>
            ` : `
                <div style="background: #fee2e2; border: 1px solid #ef4444; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="color: #dc2626; margin: 0 0 10px 0;">📚 Keep Studying</h3>
                    <p style="margin: 0;">Don't be discouraged! Review the material and speak with your teacher about areas for improvement. You can do better next time!</p>
                </div>
            `}
            
            <p>If you have any questions about your results, please contact your teacher.</p>
            
            <p>Best regards,<br>Your Examination System</p>
        </div>
        
        <div class="footer">
            <p>This email was generated automatically by the Exam Management System.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </body>
    </html>
  `
  
  const text = `
    Exam Results: ${data.examTitle}
    
    Dear ${data.studentName},
    
    Your exam results are now available:
    
    Score: ${data.score.toFixed(1)}%
    Status: ${data.passed ? 'PASSED' : 'FAILED'}
    Questions: ${data.correctAnswers} out of ${data.totalQuestions}
    Session: ${data.sessionCode}
    Submitted: ${new Date(data.submittedAt).toLocaleString()}
    
    ${data.passed 
      ? 'Congratulations! You have successfully passed the exam.' 
      : 'Please review the material and consult with your teacher for improvement areas.'}
    
    If you have any questions, please contact your teacher.
    
    Best regards,
    Your Examination System
  `
  
  return { subject, html, text }
}

// Email service configuration (to be customized based on your email provider)
interface EmailServiceConfig {
  provider: 'smtp' | 'sendgrid' | 'nodemailer'
  apiKey?: string
  host?: string
  port?: number
  username?: string
  password?: string
}

export class EmailService {
  private config: EmailServiceConfig

  constructor(config: EmailServiceConfig) {
    this.config = config
  }

  async sendResultsEmail(
    recipientEmail: string, 
    resultsData: EmailResultsData,
    teacherId: string
  ): Promise<boolean> {
    try {
      const template = generateResultsEmailTemplate(resultsData)
      
      // Log the email attempt
      const { data: emailLog, error: logError } = await supabase
        .from('result_emails')
        .insert([{
          result_id: 'temp-id', // This would be passed in a real implementation
          student_email: recipientEmail,
          teacher_id: teacherId,
          email_status: 'pending'
        }])
        .select()
        .single()

      if (logError) {
        console.error('Error logging email:', logError)
      }

      // TODO: Implement actual email sending based on provider
      switch (this.config.provider) {
        case 'smtp':
          return await this.sendViaSMTP(recipientEmail, template)
        case 'sendgrid':
          return await this.sendViaSendGrid(recipientEmail, template)
        case 'nodemailer':
          return await this.sendViaNodemailer(recipientEmail, template)
        default:
          throw new Error('Unsupported email provider')
      }
    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
  }

  private async sendViaSMTP(email: string, template: EmailTemplate): Promise<boolean> {
    // TODO: Implement SMTP sending
    console.log('Sending via SMTP to:', email)
    console.log('Subject:', template.subject)
    return new Promise(resolve => setTimeout(() => resolve(true), 2000))
  }

  private async sendViaSendGrid(email: string, template: EmailTemplate): Promise<boolean> {
    // TODO: Implement SendGrid API
    console.log('Sending via SendGrid to:', email)
    return new Promise(resolve => setTimeout(() => resolve(true), 2000))
  }

  private async sendViaNodemailer(email: string, template: EmailTemplate): Promise<boolean> {
    // TODO: Implement Nodemailer
    console.log('Sending via Nodemailer to:', email)
    return new Promise(resolve => setTimeout(() => resolve(true), 2000))
  }
}

// Default email service instance
export const defaultEmailService = new EmailService({
  provider: 'smtp', // Change this based on your email provider
  // Add your email configuration here
})