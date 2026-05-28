"use client";

import Link from "next/link";
import { LOL_ABOUT_URL, LOL_SIGNUP_URL } from "../lib/share-links";
import { trackEvent } from "../lib/analytics";
import {
  LOL_HOME_BOTTOM_BODY,
  LOL_HOME_BOTTOM_KICKER,
  LOL_PITCH_BANNER_BODY,
  LOL_PITCH_CARD,
  LOL_SIGNUP_CTA_HEADING,
} from "../lib/lol-copy";

export default function LolSignupCta({ variant = "card" }) {
  if (variant === "landing") {
    return (
      <section
        className="share-landing-signup"
        aria-labelledby="share-landing-signup-heading"
      >
        <div className="home-bottom-cta">
          <p className="home-bottom-kicker" id="share-landing-signup-heading">
            {LOL_HOME_BOTTOM_KICKER}
          </p>
          <p className="home-bottom-body">{LOL_HOME_BOTTOM_BODY}</p>
          <div className="home-bottom-actions">
            <Link
              href={LOL_SIGNUP_URL}
              className="cta-button"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("lol_signup_click", { location: "share_landing" })
              }
            >
              Explore free games for teachers
            </Link>
            <Link
              href={LOL_ABOUT_URL}
              className="home-bottom-link"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("lol_about_click", { location: "share_landing" })
              }
            >
              About Legends of Learning
            </Link>
          </div>
        </div>
        <p className="home-bottom-safety">
          <span className="home-bottom-safety-icon" aria-hidden>
            🛡️
          </span>
          <span>
            <strong>Classroom-safe by default.</strong> Every caption — curated
            or customized — passes a K-8 brand check before download.
          </span>
        </p>
      </section>
    );
  }

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
