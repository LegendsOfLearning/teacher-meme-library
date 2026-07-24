import { incrementGalleryEngagement } from "../../lib/engagement";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const memeId = String(body?.memeId || "").trim();
  const event = String(body?.event || "view").trim();
  const voterId = String(body?.voterId || "").trim();
  const allowed = new Set([
    "view",
    "download",
    "share",
    "customize",
    "upvote",
  ]);
  if (!memeId || !allowed.has(event)) {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";

  try {
    const result = await incrementGalleryEngagement(memeId, event, {
      voterId,
      ip,
    });
    if (!result) {
      return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    if (result.error === "voter_required") {
      return Response.json(
        { ok: false, error: result.error, ...result.stats },
        { status: 400 }
      );
    }
    if (result.error === "already_upvoted" || result.error === "rate_limited") {
      return Response.json(
        { ok: false, error: result.error, ...result.stats },
        { status: 409 }
      );
    }
    return Response.json({ ok: true, ...result.stats });
  } catch (e) {
    return Response.json(
      { ok: false, error: e.message || "Failed" },
      { status: 500 }
    );
  }
}
