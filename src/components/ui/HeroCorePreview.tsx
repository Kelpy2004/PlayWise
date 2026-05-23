import { Canvas } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import { useReducedMotion } from 'framer-motion'

export function HeroCorePreview() {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <div className="h-44 w-44 border border-[#00d4ff]/50 bg-[#00d4ff]/15 shadow-[0_0_90px_rgba(0,212,255,0.3)] [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]" />
      </div>
    )
  }

  return (
    <Canvas camera={{ position: [0, 0, 4] }} gl={{ alpha: true }}>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#00d4ff" />
      <pointLight position={[-4, -2, 3]} intensity={0.6} color="#3ba7ff" />
      <Float speed={2} rotationIntensity={0.75} floatIntensity={0.8}>
        <mesh rotation={[0.5, 0.2, 0.1]}>
          <icosahedronGeometry args={[1.55, 1]} />
          <meshStandardMaterial
            color="#00d4ff"
            metalness={0.85}
            roughness={0.15}
            emissive="#1a3000"
            emissiveIntensity={0.4}
          />
        </mesh>
      </Float>
      <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.6}>
        <mesh position={[2.2, -0.8, -1]} rotation={[0.3, 0.8, 0.2]}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color="#3ba7ff"
            metalness={0.9}
            roughness={0.1}
            emissive="#0a2040"
            emissiveIntensity={0.3}
            wireframe
          />
        </mesh>
      </Float>
      <Float speed={1.8} rotationIntensity={0.6} floatIntensity={0.5}>
        <mesh position={[-1.8, 1.2, -0.5]} rotation={[0.7, 0.3, 0.5]}>
          <tetrahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial
            color="#ff7351"
            metalness={0.8}
            roughness={0.2}
            emissive="#3a1500"
            emissiveIntensity={0.3}
          />
        </mesh>
      </Float>
    </Canvas>
  )
}

export default HeroCorePreview
