import { getRun, listGenerations } from "../../../../agentic/db.js";

export const dynamic = "force-dynamic";

export default async function RunDetail({ params }) {
  const { id } = await params;
  const run = getRun(Number(id));
  if (!run) return <p>Run not found.</p>;
  const gens = listGenerations(run.id);
  const config = JSON.parse(run.config_json);
  return (
    <div>
      <h1>Run {run.id}: {run.label}</h1>
      <pre style={{ background: "#f4f4f4", padding: 12, overflowX: "auto" }}>
        {JSON.stringify(config, null, 2)}
      </pre>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {gens.map((g) => (
          <div key={g.id} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
            <strong>{g.prompt_id}</strong>{" "}
            <span style={{ color: g.approved ? "#080" : "#c60" }}>
              {g.status === "error" ? "ERROR" : g.approved ? "approved" : "unapproved"}
            </span>
            {g.image_path ? (
              <img
                src={`/admin/api/image?p=${encodeURIComponent(g.image_path)}`}
                alt={g.prompt_id}
                style={{ width: "100%", marginTop: 8, borderRadius: 4 }}
              />
            ) : (
              <p style={{ color: "#c00" }}>{g.error || "no image"}</p>
            )}
            <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
              {g.renders ?? 0} renders · ${(g.cost_usd || 0).toFixed(3)} ·{" "}
              {((g.duration_ms || 0) / 1000).toFixed(0)}s
            </div>
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>trace</summary>
              <pre style={{ fontSize: 11, maxHeight: 300, overflow: "auto", background: "#f8f8f8" }}>
                {JSON.stringify(JSON.parse(g.trace_json || "[]"), null, 1)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
