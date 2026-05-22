// Share URL helpers — Imgflip-style deep links + copyable fields.

export const LOL_SIGNUP_URL =
  "https://app.legendsoflearning.com/login?admin=f";

export const LOL_ABOUT_URL =
  "https://www.legendsoflearning.com?utm_source=teacher_meme_generator&utm_medium=referral&utm_campaign=meme_awareness";

export function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${pathOrUrl}`;
  }
  return pathOrUrl;
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

  return [
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      className: "facebook",
    },
    {
      id: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      className: "x",
    },
    {
      id: "pinterest",
      label: "Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${url}&description=${text}`,
      className: "pinterest",
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
    {
      id: "email",
      label: "Email",
      href: `mailto:?subject=${title}&body=${text}%0A%0A${url}`,
      className: "email",
    },
  ];
}
