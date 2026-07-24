"use client";

import Link from "next/link";
import { LOL_ABOUT_URL, lolSignupUrl } from "../lib/share-links";
import { trackEvent, trackSignupClick } from "../lib/analytics";
import {
  CTA_LEARN_MORE,
  CTA_SIGNUP_PRIMARY,
} from "../lib/cta-copy";
import {
  LOL_FOOTER_LINE,
  LOL_HOME_BOTTOM_BODY,
  LOL_HOME_BOTTOM_KICKER,
} from "../lib/lol-copy";

/** Integrated CTA + footer for the home gallery page. */
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
              href={lolSignupUrl("home_bottom")}
              className="cta-button"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackSignupClick("home_bottom")}
            >
              {CTA_SIGNUP_PRIMARY}
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
              {CTA_LEARN_MORE}
            </Link>
          </div>
        </div>

        <footer className="home-bottom-footer">
          <span>{LOL_FOOTER_LINE}</span>
        </footer>
      </div>
    </section>
  );
}
