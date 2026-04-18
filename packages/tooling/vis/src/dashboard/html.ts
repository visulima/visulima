/**
 * Renders the self-contained dashboard HTML shell.
 *
 * The UI is a React SPA loaded from the dashboard server itself. To
 * avoid adding a frontend build step to the package, we import React
 * and `htm` from esm.sh as ES modules — `htm` gives us JSX-like
 * tagged-template literals without a transpiler. All runtime code
 * fetches JSON from the same-origin API routes served by
 * `startDashboardServer`.
 */
export const renderDashboardHtml = (): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>vis dashboard</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b0d12;
    --panel: #121521;
    --panel-elev: #181c2b;
    --border: #232839;
    --text: #e6e9f2;
    --muted: #8a91a6;
    --accent: #7c9eff;
    --good: #5dd39e;
    --warn: #f2c14e;
    --bad: #ef6461;
    --cached: #9b7ede;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .app { display: flex; min-height: 100vh; }
  .sidebar {
    width: 220px;
    background: var(--panel);
    border-right: 1px solid var(--border);
    padding: 20px 16px;
    flex-shrink: 0;
  }
  .sidebar h1 {
    font-size: 15px;
    margin: 0 0 4px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .sidebar h1 span { color: var(--accent); }
  .sidebar .env { font-size: 12px; color: var(--muted); margin-bottom: 24px; word-break: break-all; }
  .nav button {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 8px 12px;
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    font: inherit;
  }
  .nav button:hover { background: var(--panel-elev); }
  .nav button.active { background: var(--panel-elev); color: var(--accent); }
  .main { flex: 1; padding: 24px 32px; max-width: 1400px; }
  .view-title { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
  .grid { display: grid; gap: 16px; }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
  }
  .card h3 { margin: 0 0 10px; font-size: 13px; font-weight: 500; color: var(--muted); letter-spacing: 0.3px; text-transform: uppercase; }
  .stat { font-size: 28px; font-weight: 600; }
  .stat .unit { font-size: 14px; color: var(--muted); font-weight: 400; margin-left: 4px; }
  .stat.good { color: var(--good); }
  .stat.bad { color: var(--bad); }
  .stat.warn { color: var(--warn); }
  .muted { color: var(--muted); }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--border);
  }
  .badge.hit { background: rgba(93, 211, 158, 0.1); color: var(--good); border-color: rgba(93, 211, 158, 0.3); }
  .badge.remote-hit { background: rgba(155, 126, 222, 0.1); color: var(--cached); border-color: rgba(155, 126, 222, 0.3); }
  .badge.miss { background: rgba(242, 193, 78, 0.1); color: var(--warn); border-color: rgba(242, 193, 78, 0.3); }
  .badge.skipped { background: rgba(138, 145, 166, 0.1); color: var(--muted); }
  .badge.failed { background: rgba(239, 100, 97, 0.1); color: var(--bad); border-color: rgba(239, 100, 97, 0.3); }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
  th { color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  tr:hover { background: var(--panel-elev); }
  tr.clickable { cursor: pointer; }
  .row-flex { display: flex; gap: 8px; align-items: center; }
  pre.diff {
    background: var(--panel-elev);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    overflow-x: auto;
    font-size: 12.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    margin: 0;
  }
  .diff .added { color: var(--good); }
  .diff .removed { color: var(--bad); }
  .diff .modified { color: var(--warn); }
  .loading { color: var(--muted); padding: 20px; font-style: italic; }
  .sparkline { height: 40px; display: block; width: 100%; }
  .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
  .toolbar button {
    background: var(--panel);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
  }
  .toolbar button:hover { border-color: var(--accent); color: var(--accent); }
  .bar {
    display: inline-block;
    height: 6px;
    border-radius: 3px;
    background: var(--accent);
    vertical-align: middle;
  }
  .section { margin-bottom: 28px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--panel-elev); padding: 2px 6px; border-radius: 4px; }
</style>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19.0.0",
    "react-dom/client": "https://esm.sh/react-dom@19.0.0/client",
    "htm": "https://esm.sh/htm@3.1.1/react"
  }
}
</script>
</head>
<body>
<div id="root"></div>
<script type="module">
  import React, { useEffect, useMemo, useState, useCallback } from "react";
  import { createRoot } from "react-dom/client";
  import { html } from "htm";

  const fetchJson = async (path) => {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(\`\${response.status} \${response.statusText}\`);
    }

    return response.json();
  };

  const formatMs = (ms) => {
    if (ms === undefined || ms === null) return "—";
    if (ms < 1000) return \`\${Math.round(ms)}ms\`;
    if (ms < 60_000) return \`\${(ms / 1000).toFixed(1)}s\`;
    return \`\${(ms / 60_000).toFixed(1)}m\`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return \`\${(bytes / Math.pow(1024, i)).toFixed(1)} \${units[i]}\`;
  };

  const formatPercent = (ratio) => {
    if (ratio === undefined || ratio === null) return "—";
    return \`\${(ratio * 100).toFixed(1)}%\`;
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);

    return d.toLocaleString();
  };

  const statusBadgeClass = (status) => {
    switch (status) {
      case "HIT": return "badge hit";
      case "REMOTE_HIT": return "badge remote-hit";
      case "MISS": return "badge miss";
      case "SKIPPED": return "badge skipped";
      default: return "badge";
    }
  };

  const Sparkline = ({ points, color }) => {
    if (!points || points.length < 2) return html\`<span class="muted">Not enough data</span>\`;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = 100 / (points.length - 1);
    const path = points
      .map((p, i) => \`\${i === 0 ? "M" : "L"} \${(i * step).toFixed(2)} \${(40 - ((p.value - min) / range) * 36 - 2).toFixed(2)}\`)
      .join(" ");
    return html\`
      <svg class="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d=\${path} fill="none" stroke=\${color || "var(--accent)"} stroke-width="1.5" />
      </svg>
    \`;
  };

  const Overview = ({ overview, environment }) => {
    if (!overview) return html\`<div class="loading">Loading metrics…</div>\`;
    const { metrics, flaky } = overview;
    const { totals } = metrics;

    return html\`
      <div>
        <h2 class="view-title">Overview</h2>
        <div class="grid grid-4 section">
          <div class="card">
            <h3>Cache hit rate</h3>
            <div class="stat \${(metrics.cacheHitRate ?? 0) > 0.5 ? "good" : "warn"}">\${formatPercent(metrics.cacheHitRate)}</div>
            <div class="muted">\${totals.cached} / \${totals.tasks} tasks</div>
          </div>
          <div class="card">
            <h3>Total runs</h3>
            <div class="stat">\${totals.runs}</div>
            <div class="muted">\${totals.tasks} task executions</div>
          </div>
          <div class="card">
            <h3>Time saved by cache</h3>
            <div class="stat good">\${formatMs(totals.estimatedTimeSavedMs)}</div>
            <div class="muted">across all runs</div>
          </div>
          <div class="card">
            <h3>Avg run duration</h3>
            <div class="stat">\${formatMs(metrics.averageRunDurationMs)}</div>
            <div class="muted">median \${formatMs(metrics.medianRunDurationMs)}</div>
          </div>
        </div>

        <div class="grid grid-2 section">
          <div class="card">
            <h3>Cache hit rate over time</h3>
            <\${Sparkline} points=\${metrics.hitRateOverTime} color="var(--cached)" />
          </div>
          <div class="card">
            <h3>Run duration over time</h3>
            <\${Sparkline} points=\${metrics.durationOverTime} color="var(--accent)" />
          </div>
        </div>

        <div class="section">
          <div class="card">
            <h3>Most time saved by caching</h3>
            <table>
              <thead>
                <tr><th>Task</th><th>Runs</th><th>Hit rate</th><th>Avg duration</th><th>Saved</th></tr>
              </thead>
              <tbody>
                \${metrics.mostCachedTasks.length === 0
                  ? html\`<tr><td colspan="5" class="muted">No cached tasks yet.</td></tr>\`
                  : metrics.mostCachedTasks.map((t) => html\`
                    <tr key=\${t.taskId}>
                      <td><code>\${t.taskId}</code></td>
                      <td>\${t.runs}</td>
                      <td>\${formatPercent(t.hitRate)}</td>
                      <td>\${formatMs(t.averageDurationMs)}</td>
                      <td class="good">\${formatMs(t.timeSavedMs)}</td>
                    </tr>
                  \`)}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid grid-2 section">
          <div class="card">
            <h3>Slowest tasks</h3>
            <table>
              <thead><tr><th>Task</th><th>Avg duration</th><th>Runs</th></tr></thead>
              <tbody>
                \${metrics.slowestTasks.length === 0
                  ? html\`<tr><td colspan="3" class="muted">No timing data.</td></tr>\`
                  : metrics.slowestTasks.map((t) => html\`
                    <tr key=\${t.taskId}>
                      <td><code>\${t.taskId}</code></td>
                      <td>\${formatMs(t.averageDurationMs)}</td>
                      <td>\${t.misses}</td>
                    </tr>
                  \`)}
              </tbody>
            </table>
          </div>
          <div class="card">
            <h3>Most frequently invalidated</h3>
            <table>
              <thead><tr><th>Task</th><th>Miss rate</th><th>Runs</th></tr></thead>
              <tbody>
                \${metrics.mostInvalidatedTasks.length === 0
                  ? html\`<tr><td colspan="3" class="muted">No invalidations tracked yet.</td></tr>\`
                  : metrics.mostInvalidatedTasks.map((t) => html\`
                    <tr key=\${t.taskId}>
                      <td><code>\${t.taskId}</code></td>
                      <td class="warn">\${formatPercent(t.misses / t.runs)}</td>
                      <td>\${t.runs}</td>
                    </tr>
                  \`)}
              </tbody>
            </table>
          </div>
        </div>

        \${flaky && flaky.length > 0 ? html\`
          <div class="section">
            <div class="card">
              <h3>Flaky tasks</h3>
              <table>
                <thead><tr><th>Task</th><th>Runs</th><th>Failures</th><th>Rate</th><th>Last failure</th></tr></thead>
                <tbody>
                  \${flaky.map((f) => html\`
                    <tr key=\${f.taskId}>
                      <td><code>\${f.taskId}</code></td>
                      <td>\${f.totalRuns}</td>
                      <td class="bad">\${f.failures}</td>
                      <td class="bad">\${formatPercent(f.flakinessRate)}</td>
                      <td class="muted">\${formatDate(f.lastFailure)}</td>
                    </tr>
                  \`)}
                </tbody>
              </table>
            </div>
          </div>
        \` : null}
      </div>
    \`;
  };

  const RunsList = ({ runs, onSelect }) => {
    if (!runs) return html\`<div class="loading">Loading runs…</div>\`;
    if (runs.length === 0) return html\`<div class="card"><div class="muted">No recorded runs yet. Execute <code>vis run &lt;target&gt;</code> to populate history.</div></div>\`;

    return html\`
      <div class="card">
        <table>
          <thead><tr><th>Started</th><th>Duration</th><th>Tasks</th><th>Cached</th><th>Failed</th></tr></thead>
          <tbody>
            \${runs.map((r) => html\`
              <tr key=\${r.id} class="clickable" onClick=\${() => onSelect(r.id)}>
                <td>\${formatDate(r.startTime)}</td>
                <td>\${formatMs(r.duration)}</td>
                <td>\${r.stats?.total ?? "—"}</td>
                <td class="\${(r.stats?.cached ?? 0) > 0 ? "good" : "muted"}">\${r.stats?.cached ?? 0}</td>
                <td class="\${(r.stats?.failed ?? 0) > 0 ? "bad" : "muted"}">\${r.stats?.failed ?? 0}</td>
              </tr>
            \`)}
          </tbody>
        </table>
      </div>
    \`;
  };

  const CacheMissDiff = ({ runId, taskId, onClose }) => {
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      setAnalysis(null);
      setError(null);
      fetchJson(\`/api/runs/\${encodeURIComponent(runId)}/tasks/\${encodeURIComponent(taskId)}/diff\`)
        .then(setAnalysis)
        .catch((e) => setError(e.message));
    }, [runId, taskId]);

    if (error) return html\`<div class="card"><div class="bad">Error: \${error}</div></div>\`;
    if (!analysis) return html\`<div class="loading">Analyzing inputs…</div>\`;

    const lines = analysis.entries.map((entry, i) => {
      const icon = entry.change === "added" ? "+" : entry.change === "removed" ? "-" : "~";
      const cls = entry.change;
      return html\`
        <div key=\${i} class=\${cls}>
          <div><strong>\${icon} [\${entry.kind}] \${entry.key}</strong></div>
          \${entry.previous !== undefined ? html\`<div class="removed">  was: \${entry.previous}</div>\` : null}
          \${entry.current !== undefined ? html\`<div class="added">  now: \${entry.current}</div>\` : null}
        </div>
      \`;
    });

    return html\`
      <div class="card">
        <div class="toolbar">
          <button onClick=\${onClose}>← Back</button>
          <strong>Cache miss analysis:</strong> <code>\${analysis.taskId}</code>
        </div>
        <p class="muted">\${analysis.reason}</p>
        <p class="muted">
          \${analysis.previousHash
            ? html\`Compared against hash <code>\${analysis.previousHash.slice(0, 12)}</code> from \${formatDate(analysis.previousRunStartTime)}.\`
            : "No prior execution of this task was found in history."}
          \${analysis.currentHash ? html\` Current hash: <code>\${analysis.currentHash.slice(0, 12)}</code>.\` : null}
        </p>
        \${analysis.entries.length > 0
          ? html\`<pre class="diff">\${lines}</pre>\`
          : html\`<div class="muted">No input differences recorded. The previous cache entry may have been evicted.</div>\`}
      </div>
    \`;
  };

  const RunDetail = ({ runId, onBack }) => {
    const [run, setRun] = useState(null);
    const [error, setError] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);

    useEffect(() => {
      fetchJson(\`/api/runs/\${encodeURIComponent(runId)}\`).then(setRun).catch((e) => setError(e.message));
    }, [runId]);

    if (error) return html\`<div class="card"><div class="bad">Error: \${error}</div></div>\`;
    if (!run) return html\`<div class="loading">Loading run…</div>\`;

    if (selectedTask) {
      return html\`<\${CacheMissDiff} runId=\${run.id} taskId=\${selectedTask} onClose=\${() => setSelectedTask(null)} />\`;
    }

    return html\`
      <div>
        <div class="toolbar">
          <button onClick=\${onBack}>← All runs</button>
          <strong>Run</strong> <code>\${run.id}</code>
          <span class="muted">· \${formatDate(run.startTime)} · \${formatMs(run.duration)}</span>
        </div>

        <div class="grid grid-4 section">
          <div class="card"><h3>Total</h3><div class="stat">\${run.stats?.total ?? 0}</div></div>
          <div class="card"><h3>Succeeded</h3><div class="stat good">\${run.stats?.succeeded ?? 0}</div></div>
          <div class="card"><h3>Cached</h3><div class="stat" style="color: var(--cached)">\${run.stats?.cached ?? 0}</div></div>
          <div class="card"><h3>Failed</h3><div class="stat \${(run.stats?.failed ?? 0) > 0 ? "bad" : ""}">\${run.stats?.failed ?? 0}</div></div>
        </div>

        <div class="card">
          <h3>Tasks</h3>
          <table>
            <thead><tr><th>Task</th><th>Status</th><th>Duration</th><th>Hash</th><th></th></tr></thead>
            <tbody>
              \${(run.tasks || []).map((t) => html\`
                <tr key=\${t.taskId}>
                  <td><code>\${t.taskId}</code></td>
                  <td><span class=\${statusBadgeClass(t.cacheStatus)}>\${t.cacheStatus}</span></td>
                  <td>\${formatMs(t.duration)}</td>
                  <td><code>\${t.hash ? t.hash.slice(0, 12) : "—"}</code></td>
                  <td>\${t.cacheStatus === "MISS"
                    ? html\`<button class="badge" onClick=\${() => setSelectedTask(t.taskId)}>Why missed?</button>\`
                    : null}</td>
                </tr>
              \`)}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  };

  const CacheView = ({ cache }) => {
    if (!cache) return html\`<div class="loading">Loading cache…</div>\`;
    if (!cache.exists) {
      return html\`<div class="card"><div class="muted">No cache directory found at <code>\${cache.directory}</code>.</div></div>\`;
    }

    return html\`
      <div>
        <div class="grid grid-4 section">
          <div class="card"><h3>Entries</h3><div class="stat">\${cache.entries.length}</div></div>
          <div class="card"><h3>Total size</h3><div class="stat">\${formatBytes(cache.totalBytes)}</div></div>
          <div class="card"><h3>Directory</h3><div class="muted" style="word-break: break-all">\${cache.directory}</div></div>
          <div class="card"><h3>Newest entry</h3><div class="muted">\${cache.entries[0] ? formatDate(cache.entries[0].mtimeIso) : "—"}</div></div>
        </div>
        <div class="card">
          <h3>Entries</h3>
          <table>
            <thead><tr><th>Hash</th><th>Size</th><th>Age</th><th>Modified</th></tr></thead>
            <tbody>
              \${cache.entries.slice(0, 200).map((e) => html\`
                <tr key=\${e.hash}>
                  <td><code>\${e.hash.slice(0, 16)}</code></td>
                  <td>\${formatBytes(e.sizeBytes)}</td>
                  <td>\${formatMs(e.ageMs)}</td>
                  <td class="muted">\${formatDate(e.mtimeIso)}</td>
                </tr>
              \`)}
            </tbody>
          </table>
          \${cache.entries.length > 200 ? html\`<div class="muted" style="margin-top: 8px">Showing 200 of \${cache.entries.length} entries.</div>\` : null}
        </div>
      </div>
    \`;
  };

  const App = () => {
    const [view, setView] = useState("overview");
    const [runId, setRunId] = useState(null);
    const [overview, setOverview] = useState(null);
    const [runs, setRuns] = useState(null);
    const [cache, setCache] = useState(null);
    const [environment, setEnvironment] = useState(null);

    const refresh = useCallback(async () => {
      try {
        const [o, r, c, e] = await Promise.all([
          fetchJson("/api/overview"),
          fetchJson("/api/runs"),
          fetchJson("/api/cache"),
          fetchJson("/api/environment"),
        ]);
        setOverview(o);
        setRuns(r.runs);
        setCache(c);
        setEnvironment(e);
      } catch (err) {
        console.error(err);
      }
    }, []);

    useEffect(() => {
      refresh();
    }, [refresh]);

    const openRun = (id) => { setRunId(id); setView("run"); };
    const closeRun = () => { setRunId(null); setView("runs"); };

    return html\`
      <div class="app">
        <aside class="sidebar">
          <h1><span>vis</span> dashboard</h1>
          <div class="env">\${environment?.workspaceRoot ?? ""}</div>
          <nav class="nav">
            <button class=\${view === "overview" ? "active" : ""} onClick=\${() => setView("overview")}>Overview</button>
            <button class=\${view === "runs" || view === "run" ? "active" : ""} onClick=\${() => setView("runs")}>Runs</button>
            <button class=\${view === "cache" ? "active" : ""} onClick=\${() => setView("cache")}>Cache</button>
          </nav>
          <div style="margin-top: 24px">
            <button class="badge" onClick=\${refresh}>↻ Refresh</button>
          </div>
        </aside>
        <main class="main">
          \${view === "overview" ? html\`<\${Overview} overview=\${overview} environment=\${environment} />\` : null}
          \${view === "runs" ? html\`
            <h2 class="view-title">Recent runs</h2>
            <\${RunsList} runs=\${runs} onSelect=\${openRun} />
          \` : null}
          \${view === "run" && runId ? html\`<\${RunDetail} runId=\${runId} onBack=\${closeRun} />\` : null}
          \${view === "cache" ? html\`
            <h2 class="view-title">Cache</h2>
            <\${CacheView} cache=\${cache} />
          \` : null}
        </main>
      </div>
    \`;
  };

  createRoot(document.getElementById("root")).render(html\`<\${App} />\`);
</script>
</body>
</html>`;
