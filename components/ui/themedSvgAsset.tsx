import { Box, SxProps, Theme } from "@mui/material";

interface ThemedSvgAssetProps {
  src: string;
  alt: string;
  size?: number | string;
  color?: string;
  sx?: SxProps<Theme>;
}

export function ThemedSvgAsset({
  src,
  alt,
  size = 24,
  color = "text.primary",
  sx,
}: ThemedSvgAssetProps) {
  return (
    <Box
      role="img"
      aria-label={alt}
      sx={{
        width: size,
        height: size,
        display: "inline-block",
        flexShrink: 0,
        bgcolor: color,
        maskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        ...sx,
      }}
    />
  );
}
