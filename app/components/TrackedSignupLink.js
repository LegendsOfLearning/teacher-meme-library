"use client";

import Link from "next/link";
import { lolSignupUrl } from "../lib/share-links";
import { trackSignupClick } from "../lib/analytics";

/** Signup link with GA4 cta_click_signup + UTMs. */
export default function TrackedSignupLink({
  location,
  className,
  children,
  asButton = false,
}) {
  const href = lolSignupUrl(location);
  const onClick = () => trackSignupClick(location);

  if (asButton) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
