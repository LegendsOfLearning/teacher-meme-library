// Box-only admin. ADMIN_UI=true is set only in the dev box's .env.local and
// never on Vercel, so every /admin route (and its APIs) 404s in production.
// The tailnet is the auth boundary on the box.
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Meme Evals Admin" };

export default function AdminLayout({ children }) {
  if (process.env.ADMIN_UI !== "true") notFound();
  return (
    <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: 1400, margin: "0 auto" }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24, borderBottom: "2px solid #ddd", paddingBottom: 12 }}>
        <strong>Meme Evals Admin</strong>
        <Link href="/admin">Runs</Link>
        <Link href="/admin/grid">Comparison Grid</Link>
      </nav>
      {children}
    </div>
  );
}
