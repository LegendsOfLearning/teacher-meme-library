"use client";

import Link from "next/link";
import { LOL_ABOUT_URL, lolSignupUrl } from "../lib/share-links";
import { trackEvent, trackSignupClick } from "../lib/analytics";
import {
  CTA_LEARN_MORE,
  CTA_LEARN_MORE_SHORT,
  CTA_SIGNUP_PRIMARY,
  CTA_SIGNUP_PRIMARY_SHORT,
} from "../lib/cta-copy";
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
              href={lolSignupUrl("share_landing")}
              className="cta-button"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackSignupClick("share_landing")}
            >
              {CTA_SIGNUP_PRIMARY}
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
              {CTA_LEARN_MORE}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "banner") {
    return (
      <aside className="lol-signup-banner" aria-label="Legends of Learning">
        <p>{LOL_PITCH_BANNER_BODY}</p>
        <div className="lol-signup-banner-actions">
          <Link
            href={lolSignupUrl("banner")}
            className="cta-button"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackSignupClick("banner")}
          >
            {CTA_SIGNUP_PRIMARY}
          </Link>
          <Link
            href={LOL_ABOUT_URL}
            className="lol-signup-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {CTA_LEARN_MORE_SHORT}
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
          href={lolSignupUrl("customize_card")}
          className="cta-button"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSignupClick("customize_card")}
        >
          {CTA_SIGNUP_PRIMARY_SHORT}
        </Link>
        <Link
          href={LOL_ABOUT_URL}
          className="lol-signup-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {CTA_LEARN_MORE}
        </Link>
      </div>
    </aside>
  );
}
