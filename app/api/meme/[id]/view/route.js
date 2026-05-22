import { incrementMemeViews } from "../../../../lib/storage";

export async function POST(_request, { params }) {
  const { id } = await params;
  const views = await incrementMemeViews(id);
  if (views == null) {
    return Response.json({ ok: false }, { status: 404 });
  }
  return Response.json({ ok: true, views });
}
