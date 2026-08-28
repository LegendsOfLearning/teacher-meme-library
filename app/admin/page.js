import Link from "next/link";
import { listRuns } from "../../agentic/db.js";
import { getCaps, monthToDateSpend, CATEGORIES } from "../../agentic/budget.js";

export const dynamic = "force-dynamic";

export default function RunsPage() {
  const runs = listRuns();
  const caps = getCaps();
  return (
    <div>
      <h1>Eval Runs</h1>
      <div style={{ display: "flex", gap: 24, margin: "12px 0", flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => {
          const spent = monthToDateSpend(cat);
          const cap = caps[`monthly_cap_${cat}_usd`];
          const pct = Math.min(100, (spent / cap) * 100);
          return (
            <div key={cat} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 16px", minWidth: 240 }}>
              <strong>{cat} budget</strong> — ${spent.toFixed(2)} / ${cap} MTD
              <div style={{ background: "#eee", borderRadius: 4, height: 8, marginTop: 6 }}>
                <div style={{ width: `${pct}%`, background: pct > 85 ? "#c00" : "#2a7", height: 8, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 13, color: "#666", alignSelf: "center" }}>
          per-run cap ${caps.per_run_cap_usd} · per-meme cap ${caps.per_generation_cap_usd}
          <br />change: <code>node agentic/budget-cli.mjs --set &lt;key&gt; &lt;usd&gt;</code>
        </div>
      </div>
      <p style={{ color: "#666" }}>
        New run: <code>node evals/run.mjs --label &quot;...&quot;</code> on the box.
      </p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th>#</th><th>Label</th><th>Status</th><th>Started</th>
            <th>Gens</th><th>Approved</th><th>Errors</th>
            <th>Total $</th><th>Avg $/meme</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td><Link href={`/admin/runs/${r.id}`}>{r.id}</Link></td>
              <td><Link href={`/admin/runs/${r.id}`}>{r.label}</Link></td>
              <td>{r.status}</td>
              <td>{r.started_at?.slice(0, 16).replace("T", " ")}</td>
              <td>{r.generations}</td>
              <td>{r.approved_count}/{r.generations}</td>
              <td style={{ color: r.error_count ? "#c00" : undefined }}>{r.error_count}</td>
              <td>${(r.total_cost || 0).toFixed(2)}</td>
              <td>${r.generations ? ((r.total_cost || 0) / r.generations).toFixed(3) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {runs.length === 0 && <p>No runs yet.</p>}
    </div>
  );
}
