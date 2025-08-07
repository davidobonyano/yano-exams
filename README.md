# YANO Exam Platform

A comprehensive exam platform built with Next.js 15, TypeScript, Tailwind CSS, and Supabase, specifically designed for Nigerian standard classes (JSS1-3, SS1-3) with advanced anti-cheating measures.

## Features

### 🔒 Authentication & Security
- User registration with full name and class selection
- Email-based authentication via Supabase
- One-time exam attempts per user
- Row Level Security (RLS) for data protection

### 🛡️ Anti-Cheating Measures
- **Tab Switching Detection**: Monitors when users switch tabs or windows
- **Copy/Paste Prevention**: Disables text selection, copy, and paste operations
- **Right-Click Disabled**: Prevents access to context menus
- **Developer Tools Protection**: Blocks F12, Ctrl+Shift+I, and other dev tool shortcuts
- **Fullscreen Monitoring**: Tracks when users leave the exam interface
- **Violation Logging**: Records all cheating attempts in the database

### ⏱️ Smart Timer System
- **Network-Aware Timer**: Automatically pauses when internet connection is lost
- **Auto-Save Progress**: Saves answers in real-time
- **Resume Capability**: Students can continue exams after interruptions
- **Visual Time Warnings**: Color-coded alerts for remaining time

### 📚 Nigerian Education System Support
- Support for all standard classes: JSS1, JSS2, JSS3, SS1, SS2, SS3
- Pre-loaded sample questions for each class level
- BECE and WAEC preparation exams
- Subject-specific exam categories

### 📊 Comprehensive Results System
- **Instant Scoring**: Automatic grading with detailed breakdown
- **Performance Analytics**: Score percentages, points earned, and pass/fail status
- **Answer Review**: Students can review their answers with explanations
- **Detailed Reporting**: Question-by-question analysis

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **Deployment**: Vercel-ready

## Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- A Supabase account (free tier works)
- Git

### 2. Clone and Install
```bash
git clone <your-repo-url>
cd yano-exam
npm install
```

### 3. Set Up Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and API keys
3. Create `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Set Up Database
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and run the contents of `database/schema.sql`
4. Copy and run the contents of `database/seed.sql`

### 5. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see your exam platform!

## Database Structure

### Core Tables
- **users**: Extended user profiles with class levels
- **classes**: Nigerian standard classes (JSS1-3, SS1-3)
- **exams**: Exam definitions per class level
- **questions**: Individual questions with multiple choice, true/false, and short answer support
- **user_exam_attempts**: Tracks exam sessions and prevents retaking
- **user_answers**: Student responses to questions
- **exam_results**: Final scores and performance data
- **cheating_logs**: Security violation tracking

### Security Features
- Row Level Security (RLS) on all tables
- Users can only access their own data
- Students only see exams for their class level
- Questions only visible during active attempts

## Usage Guide

### For Students
1. **Register**: Create account with full name and select your class level
2. **Browse Exams**: View available exams for your class
3. **Read Instructions**: Review exam rules and anti-cheating measures
4. **Take Exam**: Complete questions within the time limit
5. **View Results**: See detailed performance breakdown and review answers

### For Administrators
- Add new exams through the Supabase dashboard
- Monitor student performance via the database
- Review cheating logs for security violations
- Manage questions and exam content

## Anti-Cheating System

The platform implements multiple layers of security:

### Client-Side Protection
- Text selection disabled (`user-select: none`)
- Context menu (right-click) blocked
- Keyboard shortcuts disabled
- Tab visibility monitoring
- Developer tools access prevented

### Server-Side Tracking
- All violations logged with timestamps
- User behavior analytics
- Attempt restriction enforcement
- Session monitoring

### Network Resilience
- Automatic timer pause on connection loss
- Real-time answer synchronization
- Offline detection and recovery

## Customization

### Adding New Classes
Update the `ClassLevel` type in `src/types/database.ts` and add to the database.

### Adding Question Types
Extend the `QuestionType` enum and update the `QuestionDisplay` component.

### Modifying Timer Behavior
Adjust timer logic in `src/components/exam/ExamTimer.tsx`.

## Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
npm run build
npm start
```

## Security Considerations

- Never expose service role keys in client-side code
- Regularly update dependencies
- Monitor for new security vulnerabilities
- Review and update RLS policies as needed
- Enable email confirmation for user accounts

## Sample Questions Included

The platform comes with sample questions for:
- **JSS1**: Basic Mathematics, English Language
- **JSS2**: Basic Science
- **JSS3**: BECE preparation (Mathematics)
- **SS1**: Physics
- **SS2**: Chemistry
- **SS3**: WAEC preparation (English)

## Support

For issues and feature requests, please check:
1. Database setup instructions in `database/README.md`
2. Common troubleshooting steps
3. Supabase documentation for backend issues

## License

This project is built for educational purposes and Nigerian secondary schools.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

Built with ❤️ for Nigerian education
