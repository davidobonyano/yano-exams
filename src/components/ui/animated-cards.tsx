'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef, useState, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  hoverScale?: number
  glowColor?: string
}

export function AnimatedCard({ 
  children, 
  className, 
  hoverScale = 1.02,
  glowColor = 'rgba(59, 130, 246, 0.3)'
}: AnimatedCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseXSpring = useSpring(x)
  const mouseYSpring = useSpring(y)

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['7.5deg', '-7.5deg'])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-7.5deg', '7.5deg'])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const xPct = mouseX / width - 0.5
    const yPct = mouseY / height - 0.5

    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={cn('relative', className)}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      whileHover={{ 
        scale: hoverScale,
        transition: { duration: 0.3 }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at center, ${glowColor}, transparent 70%)`,
          filter: 'blur(20px)',
          transform: 'translateZ(-1px)',
        }}
        whileHover={{ opacity: 1 }}
      />

      {/* Main content */}
      <div 
        className="relative z-10 h-full"
        style={{ transform: 'translateZ(20px)' }}
      >
        {children}
      </div>
    </motion.div>
  )
}

interface FloatingCardProps {
  children: ReactNode
  className?: string
  delay?: number
  amplitude?: number
}

export function FloatingCard({ 
  children, 
  className, 
  delay = 0,
  amplitude = 10 
}: FloatingCardProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -amplitude, 0],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    >
      {children}
    </motion.div>
  )
}

interface ExpandableCardProps {
  children: ReactNode
  expandedChildren?: ReactNode
  className?: string
  expandedClassName?: string
}

export function ExpandableCard({ 
  children, 
  expandedChildren, 
  className,
  expandedClassName 
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      className={cn('overflow-hidden cursor-pointer', className)}
      layout
      onClick={() => setIsExpanded(!isExpanded)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div layout="position">
        {children}
      </motion.div>
      
      <motion.div
        initial={false}
        animate={{
          height: isExpanded ? 'auto' : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn('overflow-hidden', expandedClassName)}
      >
        {expandedChildren}
      </motion.div>
    </motion.div>
  )
}

interface GlassCardProps {
  children: ReactNode
  className?: string
  blur?: string
  opacity?: number
}

export function GlassCard({ 
  children, 
  className, 
  blur = 'backdrop-blur-md',
  opacity = 0.1 
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        `bg-white/${Math.round(opacity * 100)} ${blur} border border-white/20 rounded-2xl`,
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      whileHover={{
        background: `rgba(255, 255, 255, ${opacity + 0.05})`,
        transition: { duration: 0.3 }
      }}
    >
      {children}
    </motion.div>
  )
}

interface StackedCardsProps {
  cards: { id: string; content: ReactNode }[]
  className?: string
}

export function StackedCards({ cards, className }: StackedCardsProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % cards.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [cards.length])

  return (
    <div className={cn('relative h-64', className)}>
      {cards.map((card, index) => {
        const isActive = index === activeIndex
        const isPrevious = index === (activeIndex - 1 + cards.length) % cards.length
        const isNext = index === (activeIndex + 1) % cards.length

        return (
          <motion.div
            key={card.id}
            className="absolute inset-0 rounded-2xl"
            initial={false}
            animate={{
              scale: isActive ? 1 : isPrevious ? 0.95 : isNext ? 0.9 : 0.85,
              y: isActive ? 0 : isPrevious ? 10 : isNext ? 20 : 30,
              opacity: isActive ? 1 : isPrevious ? 0.8 : isNext ? 0.6 : 0.4,
              zIndex: isActive ? 3 : isPrevious ? 2 : isNext ? 1 : 0,
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            {card.content}
          </motion.div>
        )
      })}
    </div>
  )
}

export { useState, useEffect } from 'react'