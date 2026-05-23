export default function Logo({ size = 28 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
      <defs>
        <linearGradient id="pw-g" x1="20" y1="10" x2="75" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5ce1ff" />
          <stop offset="0.5" stopColor="#00b4ff" />
          <stop offset="1" stopColor="#0070d0" />
        </linearGradient>
      </defs>
      <path
        d="M30 85V18c0-2 1-3 3-3h22c16 0 28 10 28 24s-12 24-28 24H42v22c0 2-1.5 3-3 3h-6c-1.5 0-3-1-3-3z"
        fill="url(#pw-g)"
      />
      <rect x="42" y="30" width="4" height="18" rx="1" fill="#0a1628" opacity="0.7" />
      <rect x="49" y="25" width="4" height="23" rx="1" fill="#0a1628" opacity="0.7" />
      <rect x="56" y="20" width="4" height="28" rx="1" fill="#0a1628" opacity="0.7" />
      <rect x="63" y="15" width="4" height="33" rx="1" fill="#0a1628" opacity="0.7" />
      <path
        d="M16 30c0-2 1-3.5 3-3.5h4c0 0 1 7 5 9 4 2 0 5.5-3 5.5h-1.5L22 45h-3l2-4h-2c-2 0-3-1.5-3-3.5V30z"
        fill="url(#pw-g)"
        opacity="0.9"
      />
      <line x1="19" y1="45" x2="27" y2="45" stroke="url(#pw-g)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
