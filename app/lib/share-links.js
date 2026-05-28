// Share URL helpers — Imgflip-style deep links + copyable fields.

export const LOL_SIGNUP_URL =
  "https://app.legendsoflearning.com/login?admin=f";

export const LOL_ABOUT_URL =
  "https://www.legendsoflearning.com?utm_source=teacher_meme_generator&utm_medium=referral&utm_campaign=meme_awareness";

/** Canonical origin for share links (prod URL when env is set). */
export function shareOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const origin = shareOrigin();
  if (!origin) return pathOrUrl;
  return `${origin}${pathOrUrl}`;
}

/** Resolve page URL, direct image URL, title, and share text. */
export function resolveShareContext({ share, item, imageUrl: imageUrlProp }) {
  const sharePath =
    share?.path ?? item?.pagePath ?? (item ? `/gallery/${item.id}` : "/");
  const shareTitle =
    share?.title ??
    (item ? `${item.formatName} · Teacher meme` : "Teacher meme");
  const shareText =
    share?.text ??
    (item
      ? `Found my new favorite teacher meme — "${item.captionPreview || item.formatName}"`
      : "Found my new favorite teacher meme");

  const pageUrl = absoluteUrl(sharePath);

  let imageUrl = null;
  if (imageUrlProp) {
    imageUrl = absoluteUrl(imageUrlProp);
  } else if (item?.file) {
    imageUrl = absoluteUrl(item.file.split("?")[0]);
  } else if (share?.imageUrl) {
    imageUrl = absoluteUrl(share.imageUrl);
  }

  const embedHtml = imageUrl
    ? `<a href="${pageUrl}"><img src="${imageUrl}" alt="${escapeHtmlAttr(
        shareTitle
      )}" style="max-width:100%;height:auto;" /></a>`
    : "";

  return { pageUrl, imageUrl, shareTitle, shareText, embedHtml };
}

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Social share deep links (open in new tab — no redirect through our app). */
export function buildSocialShareLinks({ pageUrl, shareText, shareTitle }) {
  const url = encodeURIComponent(pageUrl);
  const text = encodeURIComponent(shareText);
  const title = encodeURIComponent(shareTitle);
  const combined = encodeURIComponent(`${shareText} ${pageUrl}`);

  // Order tuned for US teachers: iMessage/SMS and email first; WhatsApp last.
  return [
    {
      id: "sms",
      label: "SMS",
      href: `sms:?&body=${combined}`,
      className: "sms",
    },
    {
      id: "email",
      label: "Email",
      href: `mailto:?subject=${title}&body=${text}%0A%0A${url}`,
      className: "email",
    },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      className: "facebook",
    },
    {
      id: "instagram",
      label: "Instagram",
      className: "instagram",
      action: "copy",
      copyValue: `${shareText} ${pageUrl}`,
      copyMessage: "Link copied — paste in Instagram",
    },
    {
      id: "pinterest",
      label: "Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${url}&description=${text}`,
      className: "pinterest",
    },
    {
      id: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      className: "x",
    },
    {
      id: "reddit",
      label: "Reddit",
      href: `https://www.reddit.com/submit?url=${url}&title=${title}`,
      className: "reddit",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${combined}`,
      className: "whatsapp",
    },
  ];
}
