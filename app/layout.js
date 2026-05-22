import { Montserrat } from "next/font/google";
import "./globals.css";

// Per the LOL brand guide, Montserrat is the single typeface across the
// UI (display + body). We load the full weight range we use in CSS.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata = {
  title: "Teacher Meme Library | Legends of Learning",
  description:
    "A free teacher meme library from Legends of Learning. Share or customize classroom-safe memes — free game-based learning when you're ready.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001")
  ),
  openGraph: {
    title: "Teacher Meme Generator",
    description:
      "20 real meme formats, captions written for teachers. By Legends of Learning.",
    type: "website",
    siteName: "Legends of Learning",
  },
  twitter: {
    card: "summary_large_image",
    title: "Teacher Meme Generator",
    description: "20 real meme formats, captions written for teachers.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
