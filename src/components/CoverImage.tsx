import { useState } from 'react';

interface CoverImageProps {
  src?: string | null;
  alt: string;
  /** Seed for the deterministic gradient + initial shown when there's no image
   *  or the image fails to load. Defaults to `alt`. */
  seed?: string;
  /** Applied to BOTH the <img> and the fallback element, so the caller controls
   *  sizing/positioning/object-fit in one place. */
  className?: string;
  /** Tailwind size class for the fallback initial. */
  letterClassName?: string;
}

// Brand-dark gradients. A given title always maps to the same one, so the
// placeholder feels intentional (designed) rather than broken/random.
const GRADIENTS = [
  'linear-gradient(135deg,#1c1c44,#2a1a5e)',
  'linear-gradient(135deg,#0d2137,#161038)',
  'linear-gradient(135deg,#15263f,#0c1a30)',
  'linear-gradient(135deg,#241246,#101d3c)',
  'linear-gradient(135deg,#10293a,#1a1342)',
  'linear-gradient(135deg,#2a1430,#101d36)',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export default function CoverImage({
  src,
  alt,
  seed,
  className = '',
  letterClassName = 'text-4xl',
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  const key = (seed ?? alt ?? '').trim();

  // Show the fallback when there's no src OR when the <img> errored at runtime.
  if (!src || failed) {
    const label = (key.charAt(0) || '?').toUpperCase();
    const gradient = GRADIENTS[hashString(key) % GRADIENTS.length];
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ background: gradient }}
        aria-label={alt}
        role="img"
      >
        <span className={`select-none font-black text-white/20 ${letterClassName}`}>{label}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
