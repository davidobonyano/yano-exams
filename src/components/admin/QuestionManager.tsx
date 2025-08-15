'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  BookOpen, 
  HelpCircle, 
  CheckCircle, 
  X,
  Upload,
  FileText,
  Shuffle,
  Eye
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  options: { [key: string]: string } | null
  correct_answer: string
  points: number
  explanation?: string
}

interface QuestionManagerProps {
  examId: string
  examTitle: string
  totalQuestions: number
  onClose: () => void
}

export default function QuestionManager({ examId, examTitle, totalQuestions, onClose }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)

  // Form states
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false' | 'short_answer'>('multiple_choice')
  const [options, setOptions] = useState<{ [key: string]: string }>({ A: '', B: '', C: '', D: '' })
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [points, setPoints] = useState(1)
  const [explanation, setExplanation] = useState('')
  const [bulkText, setBulkText] = useState('')

  useEffect(() => {
    fetchQuestions()
  }, [examId])

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at')

      if (error) throw error
      setQuestions(data || [])
    } catch (error) {
      console.error('Error fetching questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setQuestionText('')
    setQuestionType('multiple_choice')
    setOptions({ A: '', B: '', C: '', D: '' })
    setCorrectAnswer('')
    setPoints(1)
    setExplanation('')
    setEditingQuestion(null)
  }

  const handleAddQuestion = async () => {
    if (!questionText.trim() || !correctAnswer.trim()) {
      toast.error('Question text and correct answer are required')
      return
    }

    try {
      const questionData = {
        exam_id: examId,
        question_text: questionText.trim(),
        question_type: questionType,
        options: questionType === 'multiple_choice' ? options : null,
        correct_answer: correctAnswer.trim(),
        points,
        explanation: explanation.trim() || null
      }

      const { error } = await supabase
        .from('questions')
        .insert([questionData])

      if (error) throw error

      toast.success('Question added successfully!')
      fetchQuestions()
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding question:', error)
      toast.error('Failed to add question')
    }
  }

  const handleEditQuestion = async () => {
    if (!editingQuestion || !questionText.trim() || !correctAnswer.trim()) {
      toast.error('Question text and correct answer are required')
      return
    }

    try {
      const { error } = await supabase
        .from('questions')
        .update({
          question_text: questionText.trim(),
          question_type: questionType,
          options: questionType === 'multiple_choice' ? options : null,
          correct_answer: correctAnswer.trim(),
          points,
          explanation: explanation.trim() || null
        })
        .eq('id', editingQuestion.id)

      if (error) throw error

      toast.success('Question updated successfully!')
      fetchQuestions()
      resetForm()
    } catch (error) {
      console.error('Error updating question:', error)
      toast.error('Failed to update question')
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (error) throw error

      toast.success('Question deleted successfully!')
      fetchQuestions()
    } catch (error) {
      console.error('Error deleting question:', error)
      toast.error('Failed to delete question')
    }
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Please paste your questions')
      return
    }

    try {
      console.log('Starting bulk import with text:', bulkText.substring(0, 200) + '...')
      
      const questionsToImport = parseBulkQuestions(bulkText)
      
      console.log('Questions parsed:', questionsToImport)
      
      if (questionsToImport.length === 0) {
        toast.error('No valid questions found. Please check the format.')
        return
      }

      const questionsData = questionsToImport.map(q => ({
        exam_id: examId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        points: q.points,
        explanation: q.explanation
      }))

      console.log('Inserting questions data:', questionsData)

      const { data, error } = await supabase
        .from('questions')
        .insert(questionsData)
        .select()

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      console.log('Successfully inserted questions:', data)

      toast.success(`${questionsToImport.length} questions imported successfully!`)
      fetchQuestions()
      setBulkText('')
      setShowBulkImport(false)
    } catch (error) {
      console.error('Error importing questions:', error)
      toast.error('Failed to import questions: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const parseBulkQuestions = (text: string) => {
    const questions: Omit<Question, 'id'>[] = []
    
    // First try to split by --- separator
    let blocks = text.split(/---+/).map(block => block.trim()).filter(Boolean)
    
    // If no --- separators found, try to split by detecting Q: patterns
    if (blocks.length === 1) {
      // Split the text whenever we find a new "Q:" that's not at the beginning
      const lines = text.split('\n')
      let currentBlock: string[] = []
      const allBlocks = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // If we find a Q: and we already have content in currentBlock, start a new block
        if (line.startsWith('Q:') && currentBlock.length > 0) {
          if (currentBlock.some(l => l.trim())) { // Only add if block has content
            allBlocks.push(currentBlock.join('\n'))
          }
          currentBlock = [line]
        } else {
          currentBlock.push(line)
        }
      }
      
      // Add the last block
      if (currentBlock.length > 0 && currentBlock.some(l => l.trim())) {
        allBlocks.push(currentBlock.join('\n'))
      }
      
      blocks = allBlocks.map(block => block.trim()).filter(Boolean)
    }

    console.log(`Processing ${blocks.length} question blocks`)

    blocks.forEach((block, blockIndex) => {
      console.log(`Processing block ${blockIndex + 1}:`, block.substring(0, 100) + '...')
      
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
      let question_text = ''
      const options: { [key: string]: string } = {}
      let correct_answer = ''
      let points = 1
      let explanation = ''
      let question_type: 'multiple_choice' | 'true_false' | 'short_answer' = 'multiple_choice'

      lines.forEach(line => {
        if (line.startsWith('Q:')) {
          question_text = line.substring(2).trim()
        } else if (line.match(/^[A-D]:/)) {
          const letter = line[0]
          options[letter] = line.substring(2).trim()
        } else if (line.startsWith('Correct:')) {
          correct_answer = line.substring(8).trim()
        } else if (line.startsWith('Points:')) {
          points = parseInt(line.substring(7).trim()) || 1
        } else if (line.startsWith('Explanation:')) {
          explanation = line.substring(12).trim()
        }
      })

      // Determine question type based on options and answers
      if (Object.keys(options).length > 0) {
        question_type = 'multiple_choice'
      } else if (correct_answer.toLowerCase() === 'true' || correct_answer.toLowerCase() === 'false') {
        question_type = 'true_false'
      } else {
        question_type = 'short_answer'
      }

      if (question_text && correct_answer) {
        const questionData = {
          question_text,
          question_type,
          options: Object.keys(options).length > 0 ? options : null,
          correct_answer,
          points,
          explanation: explanation || undefined
        }
        
        console.log(`Adding question ${blockIndex + 1}:`, questionData)
        questions.push(questionData)
      } else {
        console.log(`Skipping block ${blockIndex + 1} - missing question text or correct answer`)
        console.log('Question text:', question_text)
        console.log('Correct answer:', correct_answer)
      }
    })

    console.log(`Parsed ${questions.length} questions total`)
    return questions
  }

  const startEdit = (question: Question) => {
    setEditingQuestion(question)
    setQuestionText(question.question_text)
    setQuestionType(question.question_type)
    setOptions(question.options || { A: '', B: '', C: '', D: '' })
    setCorrectAnswer(question.correct_answer)
    setPoints(question.points)
    setExplanation(question.explanation || '')
    setShowAddForm(true)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <BookOpen className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">{examTitle}</h2>
                  <p className="opacity-90">Manage Questions ({questions.length}/{totalQuestions})</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 border-b">
            <div className="flex flex-wrap gap-4">
              <MagneticButton
                onClick={() => setShowAddForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Question
              </MagneticButton>
              
              <MagneticButton
                onClick={() => setShowBulkImport(true)}
                variant="outline"
                className="px-6 py-3 rounded-xl"
              >
                <Upload className="w-5 h-5 mr-2" />
                Bulk Import
              </MagneticButton>

              <div className="ml-auto text-sm text-gray-600 flex items-center">
                <Shuffle className="w-4 h-4 mr-2" />
                Questions will be shuffled per student
              </div>
            </div>
          </div>

          {/* Questions List */}
          <div className="p-6 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No questions added yet. Start by adding your first question!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <Card key={question.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                              Q{index + 1}
                            </span>
                            <span className="text-sm text-gray-500">
                              {question.question_type.replace('_', ' ')} • {question.points} pts
                            </span>
                          </div>
                          <p className="font-medium mb-2">{question.question_text}</p>
                          
                          {question.options && (
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                              {Object.entries(question.options).map(([key, value]) => (
                                <div key={key} className={`p-2 rounded ${question.correct_answer === key ? 'bg-green-100 text-green-800' : 'bg-gray-50'}`}>
                                  <strong>{key}:</strong> {value}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center text-sm text-green-700 bg-green-100 px-2 py-1 rounded w-fit">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Correct: {question.correct_answer}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => setPreviewQuestion(question)}
                            className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                            title="Preview how students see this question"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startEdit(question)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Edit question"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Delete question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit Question Modal */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">
                      {editingQuestion ? 'Edit Question' : 'Add New Question'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddForm(false)
                        resetForm()
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <FloatingInput
                      label="Question Text"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Enter your question here..."
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <Select value={questionType} onValueChange={(value: 'multiple_choice' | 'true_false' | 'short_answer') => {
                          setQuestionType(value)
                          setCorrectAnswer('') // Reset correct answer when type changes
                          if (value === 'multiple_choice') {
                            setOptions({ A: '', B: '', C: '', D: '' }) // Reset options for multiple choice
                          }
                        }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select question type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice">📋 Multiple Choice</SelectItem>
                            <SelectItem value="true_false">✅ True/False</SelectItem>
                            <SelectItem value="short_answer">✍️ Short Answer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <FloatingInput
                        label="Points"
                        type="number"
                        min="1"
                        value={points.toString()}
                        onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                      />
                    </div>

                    {questionType === 'multiple_choice' && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Answer Options</h4>
                        {['A', 'B', 'C', 'D'].map(letter => (
                          <FloatingInput
                            key={letter}
                            label={`Option ${letter}`}
                            value={options[letter] || ''}
                            onChange={(e) => setOptions(prev => ({ ...prev, [letter]: e.target.value }))}
                            placeholder={`Enter option ${letter}...`}
                          />
                        ))}
                      </div>
                    )}

                    {questionType === 'multiple_choice' ? (
                      <div className="space-y-2">
                        <Label>Correct Answer</Label>
                        <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select the correct answer option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A - {options.A || 'Option A'}</SelectItem>
                            <SelectItem value="B">B - {options.B || 'Option B'}</SelectItem>
                            <SelectItem value="C">C - {options.C || 'Option C'}</SelectItem>
                            <SelectItem value="D">D - {options.D || 'Option D'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : questionType === 'true_false' ? (
                      <div className="space-y-2">
                        <Label>Correct Answer</Label>
                        <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select True or False" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="True">✅ True</SelectItem>
                            <SelectItem value="False">❌ False</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <FloatingInput
                        label="Correct Answer"
                        value={correctAnswer}
                        onChange={(e) => setCorrectAnswer(e.target.value)}
                        placeholder="Enter correct answer..."
                      />
                    )}

                    <FloatingInput
                      label="Explanation (Optional)"
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Explain why this is the correct answer..."
                    />

                    <div className="flex gap-4 pt-4">
                      <MagneticButton
                        onClick={editingQuestion ? handleEditQuestion : handleAddQuestion}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl"
                      >
                        {editingQuestion ? 'Update Question' : 'Add Question'}
                      </MagneticButton>
                      <MagneticButton
                        onClick={() => {
                          setShowAddForm(false)
                          resetForm()
                        }}
                        variant="outline"
                        className="flex-1 py-3 rounded-xl"
                      >
                        Cancel
                      </MagneticButton>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bulk Import Modal */}
          <AnimatePresence>
            {showBulkImport && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Bulk Import Questions</h3>
                    <button
                      onClick={() => setShowBulkImport(false)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Paste Questions</label>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="Paste your questions here. You can use '---' to separate questions or just start each new question with 'Q:'"
                        className="w-full h-80 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Expected Format</label>
                      <div className="bg-gray-50 p-4 rounded-xl h-80 overflow-y-auto font-mono text-sm">
                        <div className="mb-4 text-xs text-blue-600 font-semibold">Option 1: With separators (recommended)</div>
                        <pre className="mb-6">{`Q: What is 2 + 2?
A: 3
B: 4
C: 5
D: 6
Correct: B
Points: 1
Explanation: Basic addition
---
Q: Is the earth round?
Correct: True
Points: 1
---`}</pre>
                        <div className="mb-4 text-xs text-green-600 font-semibold">Option 2: Without separators (auto-detect)</div>
                        <pre>{`Q: What gas do plants absorb?
A: Oxygen
B: Carbon Dioxide
C: Nitrogen
D: Hydrogen
Correct: B
Points: 1
Q: Capital of Nigeria?
Correct: Abuja
Points: 2
Q: Is water wet?
Correct: True
Points: 1`}</pre>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <MagneticButton
                      onClick={handleBulkImport}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Import Questions
                    </MagneticButton>
                    <MagneticButton
                      onClick={() => setShowBulkImport(false)}
                      variant="outline"
                      className="flex-1 py-3 rounded-xl"
                    >
                      Cancel
                    </MagneticButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question Preview Modal */}
          <AnimatePresence>
            {previewQuestion && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold flex items-center">
                      <Eye className="w-6 h-6 text-purple-600 mr-2" />
                      Student Preview
                    </h3>
                    <button
                      onClick={() => setPreviewQuestion(null)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Exam Interface Preview */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 mb-4">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">Question Preview</span>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {previewQuestion.points} {previewQuestion.points === 1 ? 'point' : 'points'}
                        </span>
                      </div>
                      
                      <h2 className="text-lg font-semibold text-gray-900 mb-6">
                        {previewQuestion.question_text}
                      </h2>

                      {previewQuestion.question_type === 'multiple_choice' && previewQuestion.options && (
                        <div className="space-y-3">
                          {Object.entries(previewQuestion.options).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                            >
                              <div className="flex items-center justify-center w-8 h-8 border-2 border-gray-300 rounded-full mr-4">
                                <span className="text-sm font-medium text-gray-600">{key}</span>
                              </div>
                              <span className="text-gray-700">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {previewQuestion.question_type === 'true_false' && (
                        <div className="space-y-3">
                          <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                            <div className="flex items-center justify-center w-8 h-8 border-2 border-gray-300 rounded-full mr-4">
                              <span className="text-sm font-medium text-gray-600">A</span>
                            </div>
                            <span className="text-gray-700">True</span>
                          </div>
                          <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                            <div className="flex items-center justify-center w-8 h-8 border-2 border-gray-300 rounded-full mr-4">
                              <span className="text-sm font-medium text-gray-600">B</span>
                            </div>
                            <span className="text-gray-700">False</span>
                          </div>
                        </div>
                      )}

                      {previewQuestion.question_type === 'short_answer' && (
                        <div className="mt-4">
                          <div className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
                            <span className="text-gray-500 italic">Student will type their answer here...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Answer Information for Teacher */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Answer Information (Teacher Only)
                    </h4>
                    <div className="text-sm text-green-700">
                      <p><strong>Correct Answer:</strong> {previewQuestion.correct_answer}</p>
                      <p><strong>Question Type:</strong> {previewQuestion.question_type.replace('_', ' ')}</p>
                      {previewQuestion.explanation && (
                        <p><strong>Explanation:</strong> {previewQuestion.explanation}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <MagneticButton
                      onClick={() => setPreviewQuestion(null)}
                      variant="outline"
                      className="px-6 py-2"
                    >
                      Close Preview
                    </MagneticButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}