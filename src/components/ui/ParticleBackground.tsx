import { useEffect, useRef } from 'react'

export interface ParticleBackgroundProps {
  count?: number
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  opacity: number
}

const particleColors = [
  'rgba(0,212,255,0.4)',
  'rgba(59,167,255,0.3)',
  'rgba(255,115,81,0.2)',
  'rgba(0,212,255,0.15)',
  'rgba(255,255,255,0.08)',
]

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.random() * 0.3 - 0.15,
    vy: Math.random() * 0.3 - 0.15,
    radius: Math.random() * 1.8 + 0.5,
    color: particleColors[Math.floor(Math.random() * particleColors.length)],
    opacity: Math.random() * 0.5 + 0.1
  }
}

export function ParticleBackground({ count = 90, className = '' }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }

    const activeCanvas = canvas
    const activeContext = context
    let animationFrameId = 0
    let particles: Particle[] = []
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resizeCanvas() {
      const parent = activeCanvas.parentElement
      if (!parent) {
        return
      }

      const rect = parent.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      activeCanvas.width = Math.max(1, Math.floor(rect.width * pixelRatio))
      activeCanvas.height = Math.max(1, Math.floor(rect.height * pixelRatio))
      activeCanvas.style.width = `${rect.width}px`
      activeCanvas.style.height = `${rect.height}px`
      activeContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      particles = Array.from({ length: count }, () => createParticle(rect.width, rect.height))
    }

    function drawFrame() {
      const width = activeCanvas.clientWidth
      const height = activeCanvas.clientHeight
      activeContext.clearRect(0, 0, width, height)

      particles.forEach((particle, index) => {
        if (!prefersReducedMotion) {
          particle.x += particle.vx
          particle.y += particle.vy

          if (particle.x <= 0 || particle.x >= width) {
            particle.vx *= -1
          }

          if (particle.y <= 0 || particle.y >= height) {
            particle.vy *= -1
          }
        }

        activeContext.globalAlpha = particle.opacity
        activeContext.fillStyle = particle.color
        activeContext.beginPath()
        activeContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        activeContext.fill()

        for (let nextIndex = index + 1; nextIndex < particles.length; nextIndex += 1) {
          const nextParticle = particles[nextIndex]
          const distance = Math.hypot(particle.x - nextParticle.x, particle.y - nextParticle.y)

          if (distance < 120) {
            activeContext.globalAlpha = (1 - distance / 120) * 0.15
            activeContext.strokeStyle = 'rgba(0,212,255,0.2)'
            activeContext.lineWidth = 0.5
            activeContext.beginPath()
            activeContext.moveTo(particle.x, particle.y)
            activeContext.lineTo(nextParticle.x, nextParticle.y)
            activeContext.stroke()
          }
        }
      })

      activeContext.globalAlpha = 1
      animationFrameId = window.requestAnimationFrame(drawFrame)
    }

    resizeCanvas()
    drawFrame()

    const resizeObserver = new ResizeObserver(resizeCanvas)
    if (activeCanvas.parentElement) {
      resizeObserver.observe(activeCanvas.parentElement)
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
    }
  }, [count])

  return <canvas ref={canvasRef} aria-hidden="true" className={['absolute inset-0 h-full w-full', className].join(' ')} />
}

export default ParticleBackground
