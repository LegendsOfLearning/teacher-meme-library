"use client";

import Link from "next/link";
import { LOL_ABOUT_URL, LOL_SIGNUP_URL } from "../lib/share-links";
import { trackEvent } from "../lib/analytics";
import {
  LOL_FOOTER_LINE,
  LOL_HOME_BOTTOM_BODY,
  LOL_HOME_BOTTOM_KICKER,
} from "../lib/lol-copy";

/** Integrated CTA + safety + footer for the home gallery page. */
export default function HomePageBottom() {
  return (
    <section className="home-bottom" aria-labelledby="home-bottom-heading">
      <div className="home-bottom-inner">
        <div className="home-bottom-cta">
          <p className="home-bottom-kicker" id="home-bottom-heading">
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
                trackEvent("lol_signup_click", { location: "home_bottom" })
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
                trackEvent("lol_about_click", { location: "home_bottom" })
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
            <strong>Edit the captions</strong> — same image, your words.
            Every save runs through a K-8 safety check before download.
          </span>
        </p>

        <footer className="home-bottom-footer">
          <span>{LOL_FOOTER_LINE}</span>
        </footer>
      </div>
    </section>
  );
}
