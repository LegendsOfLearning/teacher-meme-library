import { listPromptSets } from "../../../agentic/prompt-store.js";
import { listRuns } from "../../../agentic/db.js";

export const dynamic = "force-dynamic";

// Prompt-set registry: lineage, ACTIVE designation, and usage/cost per set.
export default function PromptsPage() {
  const sets = listPromptSets();
  const runs = listRuns();
  const usage = new Map();
  for (const r of runs) {
    let promptSetId = null;
    try {
      promptSetId = JSON.parse(r.config_json).promptSetId ?? null;
    } catch {}
    if (promptSetId == null) continue;
    const u = usage.get(promptSetId) || { runs: 0, gens: 0, cost: 0, approved: 0 };
    u.runs += 1;
    u.gens += r.generations || 0;
    u.cost += r.total_cost || 0;
    u.approved += r.approved_count || 0;
    usage.set(promptSetId, u);
  }
  return (
    <div>
      <h1>Prompt Sets</h1>
      <p style={{ color: "#666" }}>
        Promote: <code>node agentic/prompt-cli.mjs --promote &lt;id&gt;</code> (also
        writes the committed frontend snapshot <code>agentic/active-prompts.json</code>).
      </p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th></th><th>#</th><th>Label</th><th>Source</th><th>Parent</th>
            <th>Runs</th><th>Gens</th><th>Approval</th><th>Total $</th><th>$/meme</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => {
            const u = usage.get(s.id) || { runs: 0, gens: 0, cost: 0, approved: 0 };
            return (
              <tr key={s.id} style={{ borderBottom: "1px solid #ddd", background: s.is_active ? "#eaf7ee" : undefined }}>
                <td style={{ fontWeight: "bold", color: "#080" }}>{s.is_active ? "ACTIVE" : ""}</td>
                <td>{s.id}</td>
                <td>{s.label}</td>
                <td>{s.source}</td>
                <td>{s.parent_id ? `#${s.parent_id}` : "—"}</td>
                <td>{u.runs}</td>
                <td>{u.gens}</td>
                <td>{u.gens ? `${Math.round((u.approved / u.gens) * 100)}%` : "—"}</td>
                <td>${u.cost.toFixed(2)}</td>
                <td>{u.gens ? `$${(u.cost / u.gens).toFixed(3)}` : "—"}</td>
                <td>{s.created_at?.slice(0, 16).replace("T", " ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h2 style={{ marginTop: 24 }}>Rationales</h2>
      {sets.filter((s) => s.rationale).map((s) => (
        <details key={s.id} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: "pointer" }}>#{s.id} {s.label}</summary>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8f8f8", padding: 12, fontSize: 13 }}>{s.rationale}</pre>
        </details>
      ))}
    </div>
  );
}
