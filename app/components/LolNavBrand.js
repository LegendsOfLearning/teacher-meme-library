import Image from "next/image";
import { LOL_HOME_URL } from "../lib/share-links";
import { LOL_NAV_LEAD } from "../lib/lol-copy";

/** Nav brand: lead copy + Legends logo linking to legendsoflearning.com */
export default function LolNavBrand() {
  return (
    <a
      href={LOL_HOME_URL}
      className="nav-brand"
      style={{ textDecoration: "none", color: "inherit" }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Legends of Learning — visit legendsoflearning.com"
    >
      <span className="nav-brand-text">{LOL_NAV_LEAD}</span>
      <Image
        src="/legends-logo-white.png"
        alt="Legends of Learning"
        width={160}
        height={48}
        className="nav-brand-logo"
        priority
      />
    </a>
  );
}
