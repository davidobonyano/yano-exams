'use client'

import { motion, stagger, useAnimate, useInView } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface TextRevealProps {
  text: string
  className?: string
  delay?: number
}

export function TextReveal({ text, className = '', delay = 0 }: TextRevealProps) {
  const [scope, animate] = useAnimate()
  const isInView = useInView(scope)

  useEffect(() => {
    if (isInView) {
      animate(
        'span',
        {
          opacity: 1,
          y: 0,
        },
        {
          duration: 0.5,
          delay: stagger(0.1, { startDelay: delay }),
        }
      )
    }
  }, [isInView, animate, delay])

  return (
    <div ref={scope} className={className}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </div>
  )
}

interface TypewriterProps {
  text: string
  className?: string
  delay?: number
  speed?: number
}

export function Typewriter({ text, className = '', delay = 0, speed = 50 }: TypewriterProps) {
  const [scope, animate] = useAnimate()
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef)

  useEffect(() => {
    if (isInView) {
      const sequence = text.split('').map((_, i) => [
        `span:nth-child(${i + 1})`,
        { opacity: 1 },
        { duration: 0, delay: delay + (i * speed) / 1000 }
      ])

      animate(sequence as any)
    }
  }, [isInView, animate, text, delay, speed])

  return (
    <div ref={containerRef} className={className}>
      <div ref={scope}>
        {text.split('').map((char, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            className="inline-block"
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

interface ScrambleTextProps {
  text: string
  className?: string
  trigger?: boolean
}

export function ScrambleText({ text, className = '', trigger = false }: ScrambleTextProps) {
  const [scope, animate] = useAnimate()
  const containerRef = useRef<HTMLDivElement>(null)

  const scrambleSequence = async () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const originalText = text
    
    // Scramble phase
    for (let i = 0; i < 10; i++) {
      const scrambled = originalText
        .split('')
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('')
      
      animate(scope.current, { textContent: scrambled }, { duration: 0.05 })
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // Reveal phase
    for (let i = 0; i <= originalText.length; i++) {
      const revealed = originalText.slice(0, i)
      const scrambled = originalText
        .slice(i)
        .split('')
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('')
      
      animate(scope.current, { textContent: revealed + scrambled }, { duration: 0.05 })
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    animate(scope.current, { textContent: originalText }, { duration: 0.1 })
  }

  useEffect(() => {
    if (trigger) {
      scrambleSequence()
    }
  }, [trigger])

  return (
    <div ref={containerRef} className={className}>
      <div ref={scope}>{text}</div>
    </div>
  )
}

interface GradientTextProps {
  text: string
  className?: string
  gradient?: string
}

export function GradientText({ 
  text, 
  className = '', 
  gradient = 'from-blue-600 via-purple-600 to-indigo-600' 
}: GradientTextProps) {
  return (
    <motion.span
      className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent font-bold ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {text}
    </motion.span>
  )
}

interface FloatingTextProps {
  text: string
  className?: string
}

export function FloatingText({ text, className = '' }: FloatingTextProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {text}
    </motion.div>
  )
}