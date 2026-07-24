"use client";

import Link from "next/link";
import { LOL_ABOUT_URL, lolSignupUrl } from "../lib/share-links";
import { trackSignupClick } from "../lib/analytics";
import { CTA_LEARN_MORE_SHORT, CTA_SIGNUP_PRIMARY_SHORT } from "../lib/cta-copy";

/** Soft brand touchpoint — no aggressive signup push. */
export default function LolSignupStrip({ className = "" }) {
  return (
    <p className={`lol-signup-strip ${className}`.trim()}>
      From Legends of Learning — free games for your classroom when you&apos;re
      ready.{" "}
      <Link
        href={lolSignupUrl("share_modal_strip")}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackSignupClick("share_modal_strip")}
      >
        {CTA_SIGNUP_PRIMARY_SHORT}
      </Link>
      {" · "}
      <Link href={LOL_ABOUT_URL} target="_blank" rel="noopener noreferrer">
        {CTA_LEARN_MORE_SHORT}
      </Link>
    </p>
  );
}
