// Browser-safe stand-in for `next/image`, aliased in the design-sync Vite build.
// Renders a plain <img>; Next-specific props are accepted and ignored.
import { type CSSProperties, type ImgHTMLAttributes } from "react";

type ImageSrc = string | { src: string };

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  src: ImageSrc;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
  loader?: unknown;
  unoptimized?: boolean;
  onLoadingComplete?: unknown;
};

export default function Image({
  src,
  alt,
  width,
  height,
  fill,
  sizes,
  priority,
  quality,
  placeholder,
  blurDataURL,
  loader,
  unoptimized,
  onLoadingComplete,
  style,
  ...rest
}: ImageProps) {
  const resolvedSrc = typeof src === "string" ? src : src?.src;
  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : style;
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={fillStyle}
      {...rest}
    />
  );
}
