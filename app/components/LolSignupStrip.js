import Link from "next/link";
import { LOL_ABOUT_URL, LOL_SIGNUP_URL } from "../lib/share-links";

/** Soft brand touchpoint — no aggressive signup push. */
export default function LolSignupStrip({ className = "" }) {
  return (
    <p className={`lol-signup-strip ${className}`.trim()}>
      From Legends of Learning — free games for your classroom when you&apos;re
      ready.{" "}
      <Link href={LOL_SIGNUP_URL} target="_blank" rel="noopener noreferrer">
        Explore free games
      </Link>
      {" · "}
      <Link href={LOL_ABOUT_URL} target="_blank" rel="noopener noreferrer">
        About us
      </Link>
    </p>
  );
}
