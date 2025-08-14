// Quick debug script to check if questions exist for the exam
// Run this in browser console to check questions

const examId = '68207de2-b8d8-4998-a4d3-04ca44d6682d'; // From your logs

// Check questions in database
supabase
  .from('questions')
  .select('*')
  .eq('exam_id', examId)
  .then(({ data, error }) => {
    console.log('Questions debug:');
    console.log('Error:', error);
    console.log('Data:', data);
    console.log('Count:', data?.length || 0);
  });

// Also check the exam itself
supabase
  .from('exams')
  .select('*')
  .eq('id', examId)
  .single()
  .then(({ data, error }) => {
    console.log('Exam debug:');
    console.log('Error:', error);
    console.log('Data:', data);
  });
