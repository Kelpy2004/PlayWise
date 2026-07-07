import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'

export interface GlitchTextProps {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span'
  className?: string
  delay?: number
}

const motionTags = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  p: motion.p,
  span: motion.span
}

export function GlitchText({ children, as = 'h2', className = '', delay = 0 }: GlitchTextProps) {
  const [isGlitching, setIsGlitching] = useState(true)
  const MotionTag = motionTags[as]
  const textValue = useMemo(() => (typeof children === 'string' ? children : ''), [children])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsGlitching(false), delay + 1000)
    return () => window.clearTimeout(timeoutId)
  }, [delay])

  return (
    <MotionTag
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay / 1000, duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={[
        'pw-glitch-text relative inline-block font-display font-black uppercase leading-[0.92] tracking-[-0.06em] text-text-primary',
        isGlitching ? 'pw-glitch-text--active animate-glitch' : '',
        className
      ].join(' ')}
      data-text={textValue}
    >
      {children}
    </MotionTag>
  )
}

export default GlitchText
