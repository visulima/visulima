/**
 * Self-contained HTML report for `vis audit`. Single file: inlined CSS + a
 * tiny vanilla-JS controller for sort/filter. No network requests, no
 * analytics, no Preact / React. The original RFC sketched a Preact bundle
 * for an "interactive" feel — in practice the report only needs sortable
 * tables and a severity filter, so vanilla JS does the job at ~2 KB.
 *
 * Breaking-change marker: semver diff between the installed version and
 * the lowest fixed version. `major` → red dot, `minor`/`patch` → green
 * dot, `none` (no fixed version) → grey question mark.
 */

import { coerce, diff } from "semver";

import type { SecurityVulnerability } from "../security/advisories";

export interface AuditHtmlFinding {
    acknowledged: boolean;
    packageName: string;
    packageVersion: string;
    /** Remediation command rendered as a one-liner. Falls back to a `# advisory only` line if absent. */
    remediation?: string;
    vulnerability: SecurityVulnerability;
}

export interface AuditHtmlEmitOptions {
    findings: AuditHtmlFinding[];
    /** Override timestamp. Tests pass a fixed Date. */
    now?: Date;
    /** Total scanned packages — surfaced in the summary band. */
    packagesScanned: number;
    tool: { name: string; version: string };
    workspaceRoot: string;
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"] as const;

type Severity = (typeof SEVERITY_ORDER)[number];

const escapeHtml = (text: string): string =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");

const advisoryUri = (id: string): string => {
    if (id.startsWith("CVE-")) {
        return `https://nvd.nist.gov/vuln/detail/${id}`;
    }

    if (id.startsWith("GHSA-")) {
        return `https://github.com/advisories/${id}`;
    }

    return `https://osv.dev/vulnerability/${id}`;
};

type BreakingMarker = { kind: "major" | "minor-patch" | "unknown"; label: string };

const breakingMarker = (installed: string, fixedVersions: string[]): BreakingMarker => {
    if (fixedVersions.length === 0) {
        return { kind: "unknown", label: "no fix" };
    }

    const installedSemver = coerce(installed);

    if (!installedSemver) {
        return { kind: "unknown", label: "non-semver" };
    }

    // Find the lowest fixed version that's > installed.
    let lowestMajor: string | undefined;
    let lowestMinorPatch: string | undefined;

    for (const fix of fixedVersions) {
        const fixSemver = coerce(fix);

        if (!fixSemver) {
            continue;
        }

        const d = diff(installedSemver, fixSemver);

        if (d === "major" || d === "premajor") {
            if (!lowestMajor) {
                lowestMajor = fix;
            }
        } else if (d && !lowestMinorPatch) {
            lowestMinorPatch = fix;
        }
    }

    if (lowestMinorPatch) {
        return { kind: "minor-patch", label: `safe to ${lowestMinorPatch}` };
    }

    if (lowestMajor) {
        return { kind: "major", label: `requires major bump to ${lowestMajor}` };
    }

    return { kind: "unknown", label: "no usable fix" };
};

const SEVERITY_RANK: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    LOW: 3,
    MODERATE: 2,
    UNKNOWN: 4,
};

const renderRow = (finding: AuditHtmlFinding): string => {
    const { acknowledged, packageName, packageVersion, remediation, vulnerability } = finding;
    const { severity } = vulnerability;
    const marker = breakingMarker(packageVersion, vulnerability.fixedVersions);
    const fix = vulnerability.fixedVersions.length > 0 ? vulnerability.fixedVersions.join(", ") : "—";
    const remediationCell = remediation
        ? `<code class="copyable" data-cmd="${escapeHtml(remediation)}">${escapeHtml(remediation)}</code>`
        : `<span class="muted">advisory only</span>`;

    return `<tr data-severity="${severity}" data-package="${escapeHtml(packageName)}" data-advisory="${escapeHtml(vulnerability.id)}">
  <td><span class="badge badge-${severity.toLowerCase()}">${severity}</span></td>
  <td><span class="marker marker-${marker.kind}" title="${escapeHtml(marker.label)}"></span></td>
  <td><code>${escapeHtml(packageName)}</code></td>
  <td><code>${escapeHtml(packageVersion)}</code></td>
  <td><a href="${escapeHtml(advisoryUri(vulnerability.id))}" rel="noreferrer noopener" target="_blank">${escapeHtml(vulnerability.id)}</a>${acknowledged ? ` <span class="ack">[acknowledged]</span>` : ""}</td>
  <td>${escapeHtml(vulnerability.summary)}</td>
  <td><code>${escapeHtml(fix)}</code></td>
  <td>${remediationCell}</td>
</tr>`;
};

export const emitAuditHtml = (options: AuditHtmlEmitOptions): string => {
    const now = options.now ?? new Date();
    const sortedFindings = [...options.findings].sort((a, b) => {
        const sa = SEVERITY_RANK[(a.vulnerability.severity) ?? "UNKNOWN"] ?? 4;
        const sb = SEVERITY_RANK[(b.vulnerability.severity) ?? "UNKNOWN"] ?? 4;

        if (sa !== sb) {
            return sa - sb;
        }

        return a.packageName.localeCompare(b.packageName) || a.packageVersion.localeCompare(b.packageVersion);
    });

    const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, LOW: 0, MODERATE: 0, UNKNOWN: 0 };

    for (const finding of sortedFindings) {
        counts[(finding.vulnerability.severity) ?? "UNKNOWN"] += 1;
    }

    const rows = sortedFindings.map((f) => renderRow(f)).join("\n");

    const summaryBadges = SEVERITY_ORDER.filter((s) => counts[s] > 0)
        .map((s) => `<span class="badge badge-${s.toLowerCase()}">${counts[s]} ${s}</span>`)
        .join(" ");

    const clean = sortedFindings.length === 0;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vis audit · ${escapeHtml(now.toISOString().slice(0, 10))}</title>
<style>
:root {
  --bg: #0e1116;
  --fg: #d6dde6;
  --muted: #8b95a1;
  --border: #20262e;
  --row-hover: #161b22;
  --critical: #ff4757;
  --high: #ff8c42;
  --medium: #fbbf24;
  --low: #38bdf8;
  --unknown: #6b7280;
  --major: #ff4757;
  --minor: #22c55e;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #ffffff;
    --fg: #1f2328;
    --muted: #57606a;
    --border: #d0d7de;
    --row-hover: #f6f8fa;
  }
}
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--fg); margin: 0; padding: 24px; }
h1 { font-size: 22px; margin: 0 0 8px; }
.meta { color: var(--muted); font-size: 13px; margin-bottom: 16px; }
.summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.controls { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.controls input { background: var(--bg); color: var(--fg); border: 1px solid var(--border); padding: 6px 10px; border-radius: 6px; font-size: 13px; min-width: 240px; }
.controls select { background: var(--bg); color: var(--fg); border: 1px solid var(--border); padding: 6px 10px; border-radius: 6px; font-size: 13px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { font-weight: 600; color: var(--muted); cursor: pointer; user-select: none; }
th:hover { color: var(--fg); }
tr:hover td { background: var(--row-hover); }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
code.copyable { cursor: pointer; padding: 2px 4px; border-radius: 4px; }
code.copyable:hover { background: var(--row-hover); }
a { color: var(--low); text-decoration: none; }
a:hover { text-decoration: underline; }
.muted { color: var(--muted); }
.ack { color: var(--muted); font-style: italic; font-size: 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.badge-critical { background: rgba(255, 71, 87, 0.2); color: var(--critical); }
.badge-high { background: rgba(255, 140, 66, 0.2); color: var(--high); }
.badge-moderate { background: rgba(251, 191, 36, 0.2); color: var(--medium); }
.badge-low { background: rgba(56, 189, 248, 0.2); color: var(--low); }
.badge-unknown { background: rgba(107, 114, 128, 0.2); color: var(--unknown); }
.marker { display: inline-block; width: 10px; height: 10px; border-radius: 50%; vertical-align: middle; }
.marker-major { background: var(--major); }
.marker-minor-patch { background: var(--minor); }
.marker-unknown { background: var(--unknown); }
.clean { padding: 32px; text-align: center; color: var(--muted); font-size: 14px; border: 1px dashed var(--border); border-radius: 8px; }
</style>
</head>
<body>
<h1>vis audit</h1>
<div class="meta">${escapeHtml(options.tool.name)} ${escapeHtml(options.tool.version)} · ${escapeHtml(now.toISOString())} · ${options.packagesScanned} packages scanned · ${sortedFindings.length} findings</div>
<div class="summary">${summaryBadges || `<span class="badge badge-low">CLEAN</span>`}</div>
${
    clean
        ? `<div class="clean">No security issues found.</div>`
        : `
<div class="controls">
  <input id="filter" type="search" placeholder="Filter by package or advisory…" aria-label="Filter findings" />
  <select id="severity" aria-label="Filter by severity">
    <option value="">All severities</option>
    <option value="CRITICAL">Critical only</option>
    <option value="HIGH">High and above</option>
    <option value="MODERATE">Moderate and above</option>
    <option value="LOW">Low and above</option>
  </select>
</div>
<table id="findings">
<thead>
<tr>
  <th data-sort="severity">Severity</th>
  <th title="Green = safe upgrade · Red = requires major bump">Δ</th>
  <th data-sort="package">Package</th>
  <th>Version</th>
  <th>Advisory</th>
  <th>Summary</th>
  <th>Fix</th>
  <th>Remediation</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>`
}
<script>
(() => {
  const rank = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3, UNKNOWN: 4 };
  const filter = document.getElementById('filter');
  const severity = document.getElementById('severity');
  const rows = Array.from(document.querySelectorAll('#findings tbody tr'));

  const apply = () => {
    const q = (filter?.value ?? '').toLowerCase().trim();
    const minSev = severity?.value ?? '';
    const sevCap = minSev ? rank[minSev] ?? 4 : 4;
    for (const row of rows) {
      const pkg = row.getAttribute('data-package') ?? '';
      const adv = row.getAttribute('data-advisory') ?? '';
      const sev = row.getAttribute('data-severity') ?? 'UNKNOWN';
      const queryHit = !q || pkg.toLowerCase().includes(q) || adv.toLowerCase().includes(q);
      const sevHit = !minSev || (rank[sev] ?? 4) <= sevCap;
      row.style.display = queryHit && sevHit ? '' : 'none';
    }
  };

  filter?.addEventListener('input', apply);
  severity?.addEventListener('change', apply);

  // Click-to-copy on remediation cells.
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('copyable')) return;
    const cmd = target.getAttribute('data-cmd') ?? target.textContent ?? '';
    navigator.clipboard?.writeText(cmd).then(() => {
      const orig = target.textContent;
      target.textContent = '✓ copied';
      setTimeout(() => { target.textContent = orig; }, 900);
    }).catch(() => {});
  });
})();
</script>
</body>
</html>
`;
};
