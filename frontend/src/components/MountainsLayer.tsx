import { useTheme } from '../context/ThemeContext';

export default function MountainsLayer() {
  const { theme } = useTheme();

  return (
    <div className="mountains-layer">
      <svg
        className="absolute bottom-0 left-0 w-full h-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ color: theme === 'dark' ? '#1a1a2e' : '#6b8a7a' }}
      >
        {/* Back range */}
        <path
          d="M0 400 L0 280 Q80 240 160 260 Q280 200 360 180 Q420 160 500 190 Q580 140 680 120 Q780 100 840 130 Q920 90 1000 110 Q1080 80 1160 100 Q1240 70 1320 90 Q1380 85 1440 100 L1440 400 Z"
          fill="currentColor"
          opacity="0.5"
        />
        {/* Front range */}
        <path
          d="M0 400 L0 320 Q100 290 180 300 Q260 260 380 240 Q440 220 520 250 Q620 200 720 190 Q800 170 880 200 Q960 160 1060 180 Q1140 150 1220 170 Q1300 140 1380 160 Q1420 155 1440 165 L1440 400 Z"
          fill="currentColor"
          opacity="0.8"
        />
        {/* Snow caps */}
        <g className="snow-caps">
          <path d="M660 125 Q680 120 700 128 Q690 115 680 120 Z" fill="white" opacity="0.9" />
          <path d="M838 132 Q855 125 870 135 Q860 120 845 128 Z" fill="white" opacity="0.85" />
          <path d="M990 112 Q1010 105 1030 115 Q1015 100 1000 108 Z" fill="white" opacity="0.9" />
          <path d="M1150 102 Q1170 95 1190 105 Q1175 90 1158 98 Z" fill="white" opacity="0.85" />
          <path d="M1310 92 Q1330 85 1350 95 Q1335 80 1318 88 Z" fill="white" opacity="0.9" />
          <path d="M360 182 Q380 175 395 185 Q385 172 368 178 Z" fill="white" opacity="0.8" />
          <path d="M500 192 Q515 185 530 194 Q520 182 508 188 Z" fill="white" opacity="0.75" />
        </g>
      </svg>
    </div>
  );
}
