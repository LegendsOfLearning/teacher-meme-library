import Image from "next/image";
import Link from "next/link";
import { LOL_NAV_LEAD } from "../lib/lol-copy";

export default function LolNavBrand({ href = "/" }) {
  const inner = (
    <>
      <span className="nav-brand-text">{LOL_NAV_LEAD}</span>
      <Image
        src="/legends-logo-white.png"
        alt="Legends of Learning"
        width={110}
        height={40}
        className="nav-brand-logo"
        priority
      />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="nav-brand"
        style={{ textDecoration: "none", color: "inherit" }}
        aria-label="Legends of Learning, a fun free resource"
      >
        {inner}
      </Link>
    );
  }

  return <div className="nav-brand">{inner}</div>;
}
