'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface CircularProgressProps {
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
  color?: string
  backgroundColor?: string
}

export function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 8,
  className = '',
  children,
  color = '#3b82f6',
  backgroundColor = '#e5e7eb'
}: CircularProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress)
    }, 100)
    return () => clearTimeout(timer)
  }, [progress])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      </svg>
      
      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

interface MultiProgressRingProps {
  segments: {
    value: number
    color: string
    label?: string
  }[]
  size?: number
  strokeWidth?: number
  className?: string
}

export function MultiProgressRing({
  segments,
  size = 120,
  strokeWidth = 8,
  className = ''
}: MultiProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  
  let accumulatedValue = 0

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress segments */}
        {segments.map((segment, index) => {
          const startOffset = (accumulatedValue / 100) * circumference
          const segmentLength = (segment.value / 100) * circumference
          
          accumulatedValue += segment.value
          
          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-startOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ 
                strokeDasharray: `${segmentLength} ${circumference - segmentLength}`,
                strokeDashoffset: -startOffset
              }}
              transition={{ duration: 1, delay: index * 0.2, ease: 'easeInOut' }}
            />
          )
        })}
      </svg>
    </div>
  )
}

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
  suffix?: string
  prefix?: string
}

export function AnimatedCounter({
  value,
  duration = 1,
  className = '',
  suffix = '',
  prefix = ''
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
      
      setCount(Math.floor(progress * value))
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return (
    <span className={className}>
      {prefix}{count}{suffix}
    </span>
  )
}

interface ProgressBarProps {
  progress: number
  height?: number
  className?: string
  color?: string
  backgroundColor?: string
  animated?: boolean
}

export function ProgressBar({
  progress,
  height = 8,
  className = '',
  color = '#3b82f6',
  backgroundColor = '#e5e7eb',
  animated = true
}: ProgressBarProps) {
  return (
    <div 
      className={`w-full rounded-full overflow-hidden ${className}`}
      style={{ height, backgroundColor }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ 
          duration: animated ? 1 : 0, 
          ease: 'easeInOut' 
        }}
      />
    </div>
  )
}

interface SteppedProgressProps {
  steps: string[]
  currentStep: number
  className?: string
}

export function SteppedProgress({
  steps,
  currentStep,
  className = ''
}: SteppedProgressProps) {
  return (
    <div className={`flex justify-between ${className}`}>
      {steps.map((step, index) => (
        <div key={index} className="flex flex-col items-center">
          <motion.div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              index <= currentStep
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.1 }}
          >
            {index + 1}
          </motion.div>
          <motion.span
            className="mt-2 text-xs text-gray-600 text-center max-w-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 + 0.2 }}
          >
            {step}
          </motion.span>
          
          {index < steps.length - 1 && (
            <motion.div
              className="absolute h-0.5 bg-gray-200 top-5"
              style={{ 
                left: '2.5rem',
                right: '2.5rem',
                width: 'calc(100% / ' + steps.length + ' - 2.5rem)'
              }}
              initial={{ scaleX: 0 }}
              animate={{ 
                scaleX: index < currentStep ? 1 : 0,
                backgroundColor: index < currentStep ? '#3b82f6' : '#e5e7eb'
              }}
              transition={{ delay: index * 0.1 + 0.5 }}
            />
          )}
        </div>
      ))}
    </div>
  )
}