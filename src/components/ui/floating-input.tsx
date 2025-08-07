'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, forwardRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: React.ReactNode
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false)
    const [hasValue, setHasValue] = useState(Boolean(props.value || props.defaultValue))

    const handleFocus = () => setIsFocused(true)
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      setHasValue(e.target.value.length > 0)
      props.onBlur?.(e)
    }

    // Update hasValue when props.value changes
    useEffect(() => {
      setHasValue(Boolean(props.value || props.defaultValue))
    }, [props.value, props.defaultValue])

    const isFloating = isFocused || hasValue

    return (
      <div className="relative group">
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
              <motion.div
                animate={{
                  color: isFocused ? '#3b82f6' : '#6b7280',
                  scale: isFocused ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {icon}
              </motion.div>
            </div>
          )}
          
          <input
            ref={ref}
            {...props}
            className={cn(
              'peer w-full bg-white border-2 border-gray-300 rounded-xl px-4 py-4 text-gray-900 text-base font-medium transition-all duration-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/20 placeholder-gray-400',
              icon ? 'pl-12' : 'pl-4',
              error ? 'border-red-500 focus:border-red-500 focus:shadow-red-500/20' : '',
              className
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(e) => {
              setHasValue(e.target.value.length > 0)
              if (props.onChange) {
                props.onChange(e)
              }
            }}
          />
          
          <motion.label
            className={cn(
              'absolute left-4 pointer-events-none select-none font-semibold transition-all duration-300 bg-white px-2 rounded-md',
              icon ? 'left-12' : 'left-4'
            )}
            animate={{
              top: isFloating ? '-8px' : '50%',
              fontSize: isFloating ? '14px' : '16px',
              color: error ? '#ef4444' : isFocused ? '#3b82f6' : '#6b7280',
              y: isFloating ? 0 : '-50%',
              scale: isFloating ? 0.9 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.label>

          {/* Animated border */}
          {/* <motion.div
            className="absolute inset-0 rounded-xl border-2 border-transparent pointer-events-none"
            style={{
              background: isFocused 
                ? 'linear-gradient(white, white) padding-box, linear-gradient(45deg, #3b82f6, #8b5cf6) border-box'
                : 'none'
            }}
            animate={{
              opacity: isFocused ? 1 : 0,
            }}
            transition={{ duration: 0.3 }}
          /> */}

          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 pointer-events-none"
            style={{
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
            }}
            animate={{
              opacity: isFocused ? 1 : 0,
            }}
          />
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 text-sm text-red-500 font-medium"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

FloatingInput.displayName = 'FloatingInput'