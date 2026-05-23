import { useMemo } from 'react';

export default function PetalsLayer() {
  const petals = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${8 + Math.random() * 10}px`,
      dur: `${7 + Math.random() * 8}s`,
      delay: `${Math.random() * 10}s`,
      rot: `${Math.random() * 360}deg`,
      dx: `${(Math.random() - 0.5) * 120}px`,
      dx2: `${(Math.random() - 0.5) * 80}px`,
    }));
  }, []);

  return (
    <div className="petals-layer">
      {petals.map(p => (
        <div
          key={p.id}
          className="petal"
          style={{
            left: p.left,
            '--psize': p.size,
            '--pdur': p.dur,
            '--pdelay': p.delay,
            '--prot': p.rot,
            '--pdx': p.dx,
            '--pdx2': p.dx2,
          }}
        />
      ))}
    </div>
  );
}
