export type NetlifyImageLoaderArgs = {
  src: string;
  width: number;
  quality?: number;
};

const netlifyImageLoader = ({ src, width, quality }: NetlifyImageLoaderArgs): string => {
  // Outside Netlify (bun dev, next start) /.netlify/images does not exist,
  // so serve the source image directly. A custom next/image loader must still
  // return a URL that includes the requested width.
  if (process.env.NODE_ENV === "development") {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}w=${width}`;
  }
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality ?? 75),
  });
  return `/.netlify/images?${params.toString()}`;
};

// next/image loaderFile modules must expose the loader as a default export.
export default netlifyImageLoader;
