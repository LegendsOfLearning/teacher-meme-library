/** Push GTM/GA4-friendly events (configure tags in GTM container). */
export function trackEvent(event, params = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
  if (typeof window.gtag === "function") {
    window.gtag("event", event, params);
  }
}

/** Standard signup CTA click — hub reads as cta_click_signup. */
export function trackSignupClick(location, extra = {}) {
  trackEvent("cta_click_signup", { location, ...extra });
}

/** Standard share event — hub reads as meme_shared. */
export function trackMemeShared(params = {}) {
  trackEvent("meme_shared", params);
}
