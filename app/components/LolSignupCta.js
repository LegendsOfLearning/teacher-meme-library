import Link from "next/link";
import { LOL_ABOUT_URL, LOL_SIGNUP_URL } from "../lib/share-links";
import {
  LOL_PITCH_BANNER_BODY,
  LOL_PITCH_CARD,
  LOL_SIGNUP_CTA_HEADING,
} from "../lib/lol-copy";

export default function LolSignupCta({ variant = "card" }) {
  if (variant === "banner") {
    return (
      <aside className="lol-signup-banner" aria-label="Legends of Learning">
        <p>{LOL_PITCH_BANNER_BODY}</p>
        <div className="lol-signup-banner-actions">
          <Link
            href={LOL_SIGNUP_URL}
            className="cta-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore free games for teachers
          </Link>
          <Link
            href={LOL_ABOUT_URL}
            className="lol-signup-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="lol-signup-card" aria-label="Legends of Learning">
      <h2>{LOL_SIGNUP_CTA_HEADING}</h2>
      <p>{LOL_PITCH_CARD}</p>
      <div className="lol-signup-card-actions">
        <Link
          href={LOL_SIGNUP_URL}
          className="cta-button"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore free games
        </Link>
        <Link
          href={LOL_ABOUT_URL}
          className="lol-signup-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          More about Legends of Learning
        </Link>
      </div>
    </aside>
  );
}
