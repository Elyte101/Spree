interface SpreeIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SpreeIcon({ size = 40, className, style }: SpreeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-label="Spree"
    >
      <rect width="100" height="100" fill="#F5F4FF" />
      {/* Bag handle */}
      <path
        d="M37 29 L37 14 L63 14 L63 29"
        stroke="#655AFF"
        strokeWidth="6.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bag body */}
      <path
        d="M15 29 L85 29 L79 88 L21 88 Z"
        stroke="#655AFF"
        strokeWidth="6.5"
        fill="rgba(101,90,255,0.06)"
        strokeLinejoin="round"
      />
      {/* X-fold crease lines */}
      <line x1="15" y1="29" x2="79" y2="88" stroke="#655AFF" strokeWidth="6.5" strokeLinecap="round" />
      <line x1="85" y1="29" x2="21" y2="88" stroke="#655AFF" strokeWidth="6.5" strokeLinecap="round" />
      {/* Horizontal mid-crease */}
      <line x1="18" y1="58" x2="82" y2="58" stroke="#655AFF" strokeWidth="6.5" strokeLinecap="round" />
      {/* 4-pointed sparkle */}
      <path d="M50 35 L52.3 42 L59.5 44 L52.3 46 L50 53 L47.7 46 L40.5 44 L47.7 42 Z" fill="#655AFF" />
    </svg>
  );
}
