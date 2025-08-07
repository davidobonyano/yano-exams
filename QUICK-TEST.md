# 🚀 Quick Test Guide - 5 Minutes to Full Demo

## Step 1: Set up Database (2 minutes)

1. **Run the main schema:**
   ```sql
   -- In Supabase SQL Editor, run:
   -- Copy/paste contents of database/schema-v2.sql
   ```

2. **Create a teacher account:**
   - Go to `http://localhost:3000/admin`
   - Register with:
     - Name: `Test Teacher`
     - Email: `teacher@test.com`
     - Password: `password123`
     - School: `Demo Secondary School`

3. **Get your teacher ID:**
   ```sql
   -- In Supabase SQL Editor:
   SELECT id FROM auth.users WHERE email = 'teacher@test.com';
   -- Copy the UUID result
   ```

4. **Load test data:**
   - Open `database/test-data.sql`
   - Replace `YOUR_TEACHER_ID_HERE` with your actual teacher UUID
   - Run the updated SQL in Supabase

## Step 2: Test the Complete Flow (3 minutes)

### 🎯 **Ready-to-Use Test Sessions:**

After running the test data, you'll have these **active sessions**:

| Session Code | Exam | Class | Duration | Questions |
|--------------|------|-------|----------|-----------|
| **123456** | JSS1 Mathematics | JSS1 | 30 min | 5 questions |
| **789012** | JSS1 English | JSS1 | 25 min | 4 questions |
| **345678** | JSS2 Science | JSS2 | 45 min | 6 questions |

### 📝 **Test Student Data:**

Use these sample students for testing:

| Student ID | Full Name | Class | Session to Join |
|------------|-----------|-------|----------------|
| JSS1/001/2024 | Alice Johnson | JSS1 | 123456 (Math) |
| JSS1/002/2024 | Bob Smith | JSS1 | 789012 (English) |
| JSS2/001/2024 | Carol Brown | JSS2 | 345678 (Science) |

## Step 3: Full Test Flow

### 🧑‍🏫 **As Teacher:**
1. Go to `http://localhost:3000/admin`
2. Login with `teacher@test.com` / `password123`
3. ✅ See your 3 exams and 3 active sessions
4. ✅ Note the session codes: 123456, 789012, 345678

### 👨‍🎓 **As Student (Test JSS1 Math):**
1. Open new browser tab: `http://localhost:3000`
2. Enter:
   - **Session Code:** `123456`
   - **Student ID:** `JSS1/001/2024`
   - **Full Name:** `Alice Johnson`
   - **Class Level:** `JSS1`
   - **School:** `Demo Secondary School`
3. Click **"Join Session"**
4. ✅ Should join successfully and see exam dashboard
5. Click **"Start Exam"**
6. ✅ Answer the 5 math questions
7. Click **"Submit Exam"**
8. ✅ See results with score and review

### 👩‍🎓 **As Second Student (Test JSS1 English):**
1. Open another browser tab: `http://localhost:3000`
2. Enter:
   - **Session Code:** `789012`
   - **Student ID:** `JSS1/002/2024`
   - **Full Name:** `Bob Smith`
   - **Class Level:** `JSS1`
3. ✅ Test the English exam with 4 questions

## 🧪 **Anti-Cheating Tests:**

While taking an exam, try:
- **Tab switching** → Should show warnings
- **Right-click** → Should be blocked
- **Ctrl+C/Ctrl+V** → Should show warnings
- **F12** → Should be blocked
- **Disconnect internet** → Timer should pause

## 🎉 **Expected Results:**

### ✅ **Working Features:**
- Session join with validation
- Real-time exam interface
- Timer with network detection
- Auto-save answers
- Anti-cheating measures
- Automatic scoring
- Results with answer review
- One-time attempt restriction

### 📊 **Sample Questions Include:**
- **Math:** Basic arithmetic, fractions, geometry
- **English:** Grammar, vocabulary, sentence completion
- **Science:** Chemistry formulas, biology, physics basics

## 🐛 **Quick Troubleshooting:**

### Session Code Not Working?
```sql
-- Check if sessions are active:
SELECT session_code, status, starts_at, ends_at 
FROM exam_sessions 
WHERE status = 'active';
```

### Class Level Mismatch?
- Make sure student class matches session class
- JSS1 students can only join JSS1 sessions

### No Questions Showing?
```sql
-- Verify questions were created:
SELECT exam_id, question_text 
FROM questions 
ORDER BY created_at;
```

## 🎯 **Demo Script (30 seconds):**

> "Here's our session-based exam platform for Nigerian schools:
> 
> 1. **Teacher creates exam** and generates session code: `123456`
> 2. **Students join with code + Student ID** - no emails needed!
> 3. **Real-time exam** with anti-cheating protection
> 4. **Automatic scoring** and detailed results
> 5. **One-time attempts** prevent retaking
> 
> Perfect for classroom use with poor internet connectivity!"

The system is now **fully functional** with realistic test data! 🚀