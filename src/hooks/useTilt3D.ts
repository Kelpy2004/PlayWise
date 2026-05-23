import { useCallback } from 'react';

export function useTilt3D(intensity = 10) {
  const handleMouseMove = useCallback((e) => {
    const card = e.currentTarget;
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * intensity;
    const y = -((e.clientY - r.top) / r.height - 0.5) * intensity;
    card.style.transform = `translateY(-4px) perspective(800px) rotateY(${x}deg) rotateX(${y}deg)`;
  }, [intensity]);

  const handleMouseLeave = useCallback((e) => {
    e.currentTarget.style.transform = '';
  }, []);

  return { onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave };
}
