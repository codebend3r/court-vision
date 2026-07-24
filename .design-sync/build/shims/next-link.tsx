// Browser-safe stand-in for `next/link`, aliased in the design-sync Vite build.
// Renders a plain anchor so components that navigate still render in previews.
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type LinkHref = string | { pathname?: string };

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: LinkHref;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
};

const resolveHref = (href: LinkHref): string =>
  typeof href === "string" ? href : (href?.pathname ?? "#");

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch, replace, scroll, shallow, ...rest },
  ref,
) {
  return (
    <a ref={ref} href={resolveHref(href)} {...rest}>
      {children}
    </a>
  );
});

export default Link;

// PlayersTabs reads useLinkStatus(); nothing is pending in a static preview.
export const useLinkStatus = (): { pending: boolean } => ({ pending: false });
