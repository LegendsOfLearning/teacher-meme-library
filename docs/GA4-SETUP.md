# GA4 — Teacher Meme Library

Production analytics for hub tracking (Organic → Meme Library).

## Quick setup

1. **GA4 Admin** → Create property `Teacher Meme Library`
2. Add **Web** data stream → `https://teacher-meme-library.vercel.app`
3. Copy **Measurement ID** (`G-XXXXXXXXXX`)
4. **Vercel** → Project env:

```bash
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_SITE_URL=https://teacher-meme-library.vercel.app
```

5. Redeploy. Verify in GA4 → Reports → Realtime.

## Hub sync (separate step)

The marketing hub pulls API data using a **numeric Property ID** (not Measurement ID):

```bash
# hub/.env in AI-automations
GA4_MEME_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Add the service account as **Viewer** on the meme GA4 property.  
Full guide: `AI-automations/hub/MEME-LIBRARY-GA4-SETUP.md`

## Events

| Event | Trigger |
|-------|---------|
| `meme_created` | Customize → save meme |
| `meme_shared` | Social share or native share sheet |
| `cta_click_signup` | Any Legends signup CTA click |

Signup links include UTMs: `utm_source=meme&utm_campaign=meme_library` so LoL GA4 can attribute teacher signups.

## GTM

Container `GTM-WCMKBMHT` loads by default. Override with `NEXT_PUBLIC_GTM_ID` if needed. Direct gtag (above) works without GTM tag configuration.

## Local dev

GA4 only loads when `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set. Optional in `.env.local` for testing — use a separate GA4 test stream.
