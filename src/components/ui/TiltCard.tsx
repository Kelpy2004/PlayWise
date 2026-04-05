import type { MouseEvent, ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'

export interface TiltCardProps {
  children: ReactNode
  className?: string
  intensity?: number
}

export function TiltCard({ children, className = '', intensity = 8 }: TiltCardProps) {
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const smoothX = useSpring(pointerX, { stiffness: 300, damping: 30 })
  const smoothY = useSpring(pointerY, { stiffness: 300, damping: 30 })
  const rotateY = useTransform(smoothX, [-1, 1], [-intensity, intensity])
  const rotateX = useTransform(smoothY, [-1, 1], [intensity, -intensity])
  const glareX = useTransform(smoothX, [-1, 1], [0, 100])
  const glareY = useTransform(smoothY, [-1, 1], [0, 100])
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.16), transparent 42%)`

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    pointerX.set(x)
    pointerY.set(y)
  }

  function handleMouseLeave() {
    pointerX.set(0)
    pointerY.set(0)
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={['relative will-change-transform', className].join(' ')}
      style={{ perspective: 800, rotateX, rotateY, transformStyle: 'preserve-3d' }}
    >
      <motion.div className="pointer-events-none absolute inset-0 z-20 opacity-80" style={{ background: glare }} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

export default TiltCard
