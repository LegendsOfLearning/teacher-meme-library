import Link from "next/link";
import LolNavBrand from "../components/LolNavBrand";
import { LOL_AWARDS_URL, LOL_SIGNUP_URL } from "../lib/share-links";

export const metadata = {
  title: "Why Memes? | Legends of Learning",
  description:
    "Why teacher memes: community, resilience, and classroom joy that supports better learning outcomes.",
};

export default function WhyMemesPage() {
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-link">
          ← Back to memes
        </Link>
        <LolNavBrand />
      </nav>

      <main className="why-page">
        {/* Hero */}
        <header className="why-hero">
          <h1 className="why-title">Why memes?</h1>
          <p className="why-lede">
            Because Legends of Learning is all about how fun in the
            classroom can lead to <strong>serious learning gains!</strong>
          </p>
        </header>

        {/* Core message: the two big ideas */}
        <section className="why-highlights" aria-label="The big idea">
          <blockquote className="why-quote why-quote--purple">
            <span className="why-quote-mark" aria-hidden>
              “
            </span>
            <p>Fun in the classroom can lead to serious learning gains.</p>
          </blockquote>
          <blockquote className="why-quote why-quote--blue">
            <span className="why-quote-mark" aria-hidden>
              “
            </span>
            <p>Teachers who laugh together become a stronger community.</p>
          </blockquote>
        </section>

        {/* Story blocks */}
        <section className="why-story">
          <div className="why-block">
            <h2 className="why-block-title">Teachers are stronger together</h2>
            <p>
              Teachers who can poke fun at themselves with other teachers
              become part of a community.
            </p>
            <p>
              Those connections make teachers stronger and more resilient
              for their students. That&apos;s why we&apos;re all here, after
              all.
            </p>
          </div>

          <div className="why-block">
            <h2 className="why-block-title">Why fun matters</h2>
            <p>
              Students who enjoy Legends of Learning curriculum games engage
              with the material in a deeper way.
            </p>
            <p>
              That leads to increased test scores, as multiple 3rd-party
              studies on Legends of Learning content have shown.
            </p>
            <a
              className="why-research-link"
              href={LOL_AWARDS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
            </a>
          </div>
        </section>

        {/* Dedicated CTA */}
        <section className="why-cta" aria-labelledby="why-cta-heading">
          <h2 className="why-cta-title" id="why-cta-heading">
            Bring more fun to your classroom
          </h2>
          <p className="why-cta-body">
            Have some fun with your fellow teachers, and when you&apos;re
            ready, bring that joy into the classroom with free, game-based
            learning.
          </p>
          <div className="why-cta-actions">
            <a
              href={LOL_SIGNUP_URL}
              className="cta-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign up free
            </a>
            <Link href="/" className="why-cta-secondary">
              Browse memes
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
