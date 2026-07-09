import { Montserrat } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { serverShareOrigin } from "./lib/share-links";

// Per the LOL brand guide, Montserrat is the single typeface across the
// UI (display + body). We load the full weight range we use in CSS.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata = {
  title: "Free Classroom Memes | Legends of Learning",
  description:
    "Free classroom memes from Legends of Learning. Share or customize classroom-safe memes, plus free game-based learning when you're ready.",
  metadataBase: new URL(serverShareOrigin()),
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

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || "GTM-WCMKBMHT";
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      </head>
      <body>
        {GA4_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA4_ID}', { send_page_view: true });
              `}
            </Script>
          </>
        ) : null}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
