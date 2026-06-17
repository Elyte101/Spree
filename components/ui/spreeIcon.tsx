import Image from "next/image";

interface SpreeIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SpreeIcon({ size = 40, className, style }: SpreeIconProps) {
  return (
    <Image
      src="/spree-logo.png"
      alt="Spree"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", ...style }}
      priority
    />
  );
}
