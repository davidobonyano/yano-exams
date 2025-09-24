// Question Shuffling Utilities
// Ensures each student gets questions in different order for fair assessment
import { Question, QuestionType } from '@/types/database-v2'

interface ShuffledQuestion extends Question {
  shuffled_options?: { [key: string]: string }
  original_correct_answer: string
  shuffled_correct_answer: string
}

/**
 * Creates a deterministic shuffle based on student ID and exam ID
 * This ensures the same student always gets the same order for consistency
 */
export function createStudentSeed(studentId: string, examId: string): number {
  let hash = 0
  const combined = `${studentId}-${examId}`
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash)
}

/**
 * Seeded random number generator for consistent shuffling
 */
class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed % 2147483647
    if (this.seed <= 0) this.seed += 2147483646
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  /**
   * Fisher-Yates shuffle with seeded random
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    
    return result
  }
}

/**
 * Shuffles questions for a specific student
 */
export function shuffleQuestionsForStudent(
  questions: Question[],
  studentId: string,
  examId: string
): ShuffledQuestion[] {
  const seed = createStudentSeed(studentId, examId)
  const rng = new SeededRandom(seed)
  
  // First shuffle the question order
  const shuffledQuestions = rng.shuffle(questions)
  
  // Then shuffle options for multiple choice questions
  return shuffledQuestions.map(question => {
    if (question.question_type !== 'multiple_choice' || !question.options) {
      return {
        ...question,
        original_correct_answer: question.correct_answer,
        shuffled_correct_answer: question.correct_answer
      }
    }

    // Shuffle multiple choice options
    const optionEntries = Object.entries(question.options)
    const shuffledOptions = rng.shuffle(optionEntries)
    
    // Create new option mapping (A, B, C, D)
    const newOptions: { [key: string]: string } = {}
    const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] // Support up to 8 options
    let newCorrectAnswer = question.correct_answer
    
    shuffledOptions.forEach(([originalKey, value], index) => {
      const newKey = optionKeys[index]
      newOptions[newKey] = value
      
      // Track where the correct answer moved to
      if (originalKey === question.correct_answer) {
        newCorrectAnswer = newKey
      }
    })

    return {
      ...question,
      shuffled_options: newOptions,
      original_correct_answer: question.correct_answer,
      shuffled_correct_answer: newCorrectAnswer,
      options: newOptions // Replace original options with shuffled ones
    }
  })
}

/**
 * Gets shuffled questions for exam interface
 */
export async function getShuffledQuestionsForStudent(
  examId: string,
  studentId: string
): Promise<ShuffledQuestion[]> {
  // Placeholder: fetch and shuffle elsewhere
  void examId
  void studentId
  return []
}

/**
 * Validates if a student's answer is correct against the original question
 */
export function validateStudentAnswer(
  studentAnswer: string,
  shuffledQuestion: ShuffledQuestion
): boolean {
  // For multiple choice, check against the shuffled correct answer
  if (shuffledQuestion.question_type === 'multiple_choice') {
    return studentAnswer.toUpperCase() === shuffledQuestion.shuffled_correct_answer.toUpperCase()
  }
  
  // For true/false with options (A: True, B: False format), check against shuffled answer
  if (shuffledQuestion.question_type === 'true_false' && shuffledQuestion.shuffled_correct_answer) {
    return studentAnswer.toUpperCase() === shuffledQuestion.shuffled_correct_answer.toUpperCase()
  }
  
  // For other types, check against original correct answer
  return studentAnswer.toLowerCase().trim() === shuffledQuestion.original_correct_answer.toLowerCase().trim()
}

/**
 * Database function to store shuffled question order per student
 * This ensures consistency across page refreshes and session restoration
 */
export interface StudentQuestionOrder {
  id: string
  student_id: string
  exam_id: string
  question_order: string[] // Array of question IDs in shuffled order
  option_mappings: { [questionId: string]: { [originalKey: string]: string } } // Maps original options to shuffled options
  created_at: string
}

/**
 * Generates and stores question order for a student
 */
export function generateStudentQuestionOrder(
  questions: Question[],
  studentId: string,
  examId: string
): StudentQuestionOrder {
  const shuffledQuestions = shuffleQuestionsForStudent(questions, studentId, examId)
  
  const questionOrder = shuffledQuestions.map(q => q.id)
  const optionMappings: { [questionId: string]: { [originalKey: string]: string } } = {}
  
  shuffledQuestions.forEach(question => {
    if (question.question_type === 'multiple_choice' && question.shuffled_options) {
      // Create reverse mapping for storage
      const mapping: { [originalKey: string]: string } = {}
      Object.entries(question.shuffled_options).forEach(([newKey, value]) => {
        // Find original key for this value
        const originalEntry = Object.entries(question.options || {}).find(([originalKey, v]) => v === value)
        if (originalEntry) {
          mapping[originalEntry[0]] = newKey
        }
      })
      optionMappings[question.id] = mapping
    }
  })
  
  return {
    id: `${studentId}-${examId}`,
    student_id: studentId,
    exam_id: examId,
    question_order: questionOrder,
    option_mappings: optionMappings,
    created_at: new Date().toISOString()
  }
}

/**
 * Test function to verify shuffling works correctly
 */
export function testShuffling() {
  const sampleQuestions: Question[] = [
    {
      id: '1',
      exam_id: 'EXAM001',
      question_text: 'What is 2 + 2?',
      question_type: 'multiple_choice' as QuestionType,
      options: { A: '3', B: '4', C: '5', D: '6' },
      correct_answer: 'B',
      points: 1,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      exam_id: 'EXAM001',
      question_text: 'Is earth round?',
      question_type: 'true_false' as QuestionType,
      options: { A: 'True', B: 'False' },
      correct_answer: 'A',
      points: 1,
      created_at: new Date().toISOString()
    }
  ]
  
  const student1Questions = shuffleQuestionsForStudent(sampleQuestions, 'STUDENT001', 'EXAM001')
  const student2Questions = shuffleQuestionsForStudent(sampleQuestions, 'STUDENT002', 'EXAM001')
  
  console.log('Student 1 Questions:', student1Questions)
  console.log('Student 2 Questions:', student2Questions)
  
  // Verify different students get different orders
  const sameOrder = JSON.stringify(student1Questions) === JSON.stringify(student2Questions)
  console.log('Same order for both students:', sameOrder) // Should be false
  
  // Verify same student gets consistent order
  const student1Again = shuffleQuestionsForStudent(sampleQuestions, 'STUDENT001', 'EXAM001')
  const consistentOrder = JSON.stringify(student1Questions) === JSON.stringify(student1Again)
  console.log('Consistent order for same student:', consistentOrder) // Should be true
}