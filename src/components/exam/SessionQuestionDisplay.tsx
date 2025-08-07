'use client'

import { Question } from '@/types/database-v2'

interface SessionQuestionDisplayProps {
  question: Question
  answer: string
  onAnswerChange: (answer: string) => void
  isSaving?: boolean
}

export default function SessionQuestionDisplay({ question, answer, onAnswerChange, isSaving = false }: SessionQuestionDisplayProps) {
  const renderMultipleChoice = () => {
    if (!question.options) return null

    return (
      <div className="space-y-3">
        {Object.entries(question.options).map(([key, value]) => (
          <label
            key={key}
            className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="radio"
              name={`question_${question.id}`}
              value={key}
              checked={answer === key}
              onChange={(e) => onAnswerChange(e.target.value)}
              className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">{key}.</span>
              <span className="ml-2 text-gray-700">{value}</span>
            </div>
          </label>
        ))}
      </div>
    )
  }

  const renderTrueFalse = () => {
    return (
      <div className="space-y-3">
        <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
          <input
            type="radio"
            name={`question_${question.id}`}
            value="true"
            checked={answer === 'true'}
            onChange={(e) => onAnswerChange(e.target.value)}
            className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
          />
          <span className="text-gray-700">True</span>
        </label>
        <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
          <input
            type="radio"
            name={`question_${question.id}`}
            value="false"
            checked={answer === 'false'}
            onChange={(e) => onAnswerChange(e.target.value)}
            className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
          />
          <span className="text-gray-700">False</span>
        </label>
      </div>
    )
  }

  const renderShortAnswer = () => {
    return (
      <textarea
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        rows={4}
        placeholder="Enter your answer here..."
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
      />
    )
  }

  const renderAnswerSection = () => {
    switch (question.question_type) {
      case 'multiple_choice':
        return renderMultipleChoice()
      case 'true_false':
        return renderTrueFalse()
      case 'short_answer':
        return renderShortAnswer()
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Question */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 leading-relaxed">
            {question.question_text}
          </h2>
          <div className="ml-4 flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              {question.points} {question.points === 1 ? 'point' : 'points'}
            </span>
          </div>
        </div>
      </div>

      {/* Answer Section */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {question.question_type === 'multiple_choice' && 'Select one answer:'}
          {question.question_type === 'true_false' && 'Select True or False:'}
          {question.question_type === 'short_answer' && 'Your answer:'}
        </h3>
        {renderAnswerSection()}
      </div>

      {/* Answer Status */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          {answer ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-700">Answered</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              <span className="text-gray-500">Not answered</span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-2 text-gray-500">
          <span>Question type: {question.question_type.replace('_', ' ')}</span>
          {isSaving && (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-xs text-blue-600">Saving...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}