import { listRuns, gridData } from "../../../agentic/db.js";
import { canonicalPrompts } from "../../../evals/prompts.mjs";

export const dynamic = "force-dynamic";

// The visual-comparison grid: prompts as rows, runs as columns. Pass
// ?runs=1,3,7 to pick columns; default is the 4 most recent runs.
export default async function GridPage({ searchParams }) {
  const sp = await searchParams;
  const allRuns = listRuns();
  const selected = sp?.runs
    ? sp.runs.split(",").map(Number).filter(Boolean)
    : allRuns.slice(0, 4).map((r) => r.id);
  const runs = allRuns
    .filter((r) => selected.includes(r.id))
    .sort((a, b) => a.id - b.id);
  const prompts = canonicalPrompts();
  const cells = runs.length ? gridData(runs.map((r) => r.id)) : [];
  const byKey = new Map(cells.map((c) => [`${c.run_id}:${c.prompt_id}`, c]));

  return (
    <div>
      <h1>Comparison Grid</h1>
      <p style={{ color: "#666" }}>
        Columns:{" "}
        {allRuns.map((r) => (
          <a
            key={r.id}
            href={`/admin/grid?runs=${
              selected.includes(r.id)
                ? selected.filter((x) => x !== r.id).join(",")
                : [...selected, r.id].join(",")
            }`}
            style={{
              marginRight: 10,
              fontWeight: selected.includes(r.id) ? "bold" : "normal",
            }}
          >
            [{selected.includes(r.id) ? "x" : " "}] {r.id}: {r.label}
          </a>
        ))}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left" }}>
                Prompt
              </th>
              {runs.map((r) => (
                <th key={r.id} style={{ minWidth: 220, textAlign: "left" }}>
                  <a href={`/admin/runs/${r.id}`}>#{r.id} {r.label}</a>
                  <div style={{ fontWeight: "normal", fontSize: 12, color: "#666" }}>
                    {r.started_at?.slice(0, 10)} · ${(r.total_cost || 0).toFixed(2)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #ddd" }}>
                <td style={{ position: "sticky", left: 0, background: "#fff", fontSize: 13, maxWidth: 180 }}>
                  <strong>{p.situation}</strong>
                  <br />
                  {p.tone}
                </td>
                {runs.map((r) => {
                  const c = byKey.get(`${r.id}:${p.id}`);
                  return (
                    <td key={r.id} style={{ verticalAlign: "top" }}>
                      {c?.image_path ? (
                        <div>
                          <img
                            src={`/admin/api/image?p=${encodeURIComponent(c.image_path)}`}
                            alt={`${p.id} run ${r.id}`}
                            width={200}
                            style={{ borderRadius: 4, display: "block" }}
                          />
                          <span style={{ fontSize: 12, color: c.approved ? "#080" : "#c60" }}>
                            {c.approved ? "✓" : "✗"} ${(c.cost_usd || 0).toFixed(3)} ·{" "}
                            {c.renders}r
                            {c.judge_score != null && (
                              <strong style={{ marginLeft: 6, color: c.judge_score >= 7 ? "#080" : c.judge_score >= 5 ? "#c60" : "#c00" }}>
                                J{c.judge_score}
                              </strong>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#bbb", fontSize: 12 }}>
                          {c?.status === "error" ? "error" : "—"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
