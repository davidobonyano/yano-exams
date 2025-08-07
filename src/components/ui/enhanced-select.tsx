'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
  disabled?: boolean
}

interface EnhancedSelectProps {
  options: Option[]
  value?: string
  placeholder?: string
  label?: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
  error?: string
}

export function EnhancedSelect({
  options,
  value,
  placeholder = 'Select an option',
  label,
  onChange,
  disabled = false,
  className,
  error
}: EnhancedSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value || '')
  const selectRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(option => option.value === selectedValue)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setSelectedValue(value || '')
  }, [value])

  const handleSelect = (optionValue: string) => {
    setSelectedValue(optionValue)
    setIsOpen(false)
    onChange?.(optionValue)
  }

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div ref={selectRef} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'relative w-full bg-white border-2 border-gray-300 rounded-xl px-4 py-4 text-left text-gray-900 text-base font-medium transition-all duration-300 focus:outline-none focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400',
            error ? 'border-red-500 focus:border-red-500 focus:shadow-red-500/20' : '',
            isOpen ? 'border-blue-500 shadow-lg shadow-blue-500/20' : ''
          )}
        >
          <span className={cn(
            'block truncate',
            selectedOption ? 'text-gray-900' : 'text-gray-500'
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          
          <span className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </motion.div>
          </span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto"
            >
              <div className="py-2">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      'relative w-full text-left px-4 py-3 text-base font-medium transition-colors duration-150',
                      option.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-900 hover:bg-blue-50 hover:text-blue-700 cursor-pointer',
                      selectedValue === option.value
                        ? 'bg-blue-100 text-blue-700'
                        : ''
                    )}
                  >
                    <span className="block truncate">{option.label}</span>
                    {selectedValue === option.value && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <Check className="h-5 w-5 text-blue-600" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
    </div>
  )
}