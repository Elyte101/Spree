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
      <defs>
        <linearGradient
          id="spree-s-grad"
          x1="76" y1="18"
          x2="24" y2="82"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#9B7EFF" />
          <stop offset="100%" stopColor="#5B1EEE" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="16" fill="#FFFFFF" />
      {/* S stroke */}
      <path
        d="M 76,18 C 24,18 24,50 50,50 C 76,50 76,82 24,82"
        fill="none"
        stroke="url(#spree-s-grad)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Terminal balls — slightly larger than the stroke caps */}
      <circle cx="76" cy="18" r="11" fill="url(#spree-s-grad)" />
      <circle cx="24" cy="82" r="11" fill="url(#spree-s-grad)" />
    </svg>
  );
}
