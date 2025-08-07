'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function MagneticButton({
  children,
  className,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md'
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springX = useSpring(x, { stiffness: 300, damping: 30 })
  const springY = useSpring(y, { stiffness: 300, damping: 30 })

  const rotateX = useTransform(springY, [-100, 100], [10, -10])
  const rotateY = useTransform(springX, [-100, 100], [-10, 10])

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return

    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    x.set((e.clientX - centerX) * 0.5)
    y.set((e.clientY - centerY) * 0.5)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  const variants = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg hover:shadow-xl',
    outline: 'border-2 border-blue-500 text-blue-600 hover:bg-blue-50 bg-white/80 backdrop-blur-sm',
    ghost: 'text-gray-700 hover:bg-gray-100 bg-transparent'
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }

  return (
    <motion.button
      ref={ref}
      className={cn(
        'relative rounded-xl font-semibold transition-all duration-300 transform-gpu cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300"
        style={{
          background: variant === 'primary' 
            ? 'linear-gradient(45deg, rgba(59, 130, 246, 0.4), rgba(139, 92, 246, 0.4))'
            : 'rgba(59, 130, 246, 0.2)',
          filter: 'blur(20px)',
          transform: 'translateZ(-1px)',
        }}
        whileHover={{ opacity: disabled ? 0 : 1 }}
      />

      {/* Content */}
      <motion.span
        className="relative z-10 flex items-center justify-center gap-2"
        style={{ transform: 'translateZ(10px)' }}
      >
        {children}
      </motion.span>

      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 rounded-xl overflow-hidden"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: disabled ? 0 : 1 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%)',
          }}
          animate={{
            x: [-200, 200],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
        />
      </motion.div>
    </motion.button>
  )
}

export function GlowButton({
  children,
  className,
  onClick,
  disabled = false,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      className={cn(
        'relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl',
        'hover:from-blue-700 hover:to-purple-700 transition-all duration-300',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
    >
      {/* Animated glow */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{
          background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
          filter: 'blur(20px)',
          opacity: 0.6,
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.6, 0.8, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}