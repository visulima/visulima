/**
 * Self-contained HTML report for `vis audit`. Single file: the stylesheet is
 * a Tailwind entry compiled and inlined at build time by packem
 * (`rollup.css.mode: "inline"`), plus a tiny vanilla-JS controller for
 * sort/filter. No network requests, no analytics, no Preact / React. The
 * original RFC sketched a Preact bundle for an "interactive" feel — in
 * practice the report only needs sortable tables and a severity filter, so
 * vanilla JS does the job at ~2 KB.
 *
 * Breaking-change marker: semver diff between the installed version and
 * the lowest fixed version. `major` → red dot, `minor`/`patch` → green
 * dot, `none` (no fixed version) → grey question mark.
 *
 * Class-attribute strategy: layout/typography utilities live as Tailwind
 * classes directly on the HTML; only var()-driven colors/borders, pseudo
 * states, data-attribute selectors, sibling combinators, and the literal
 * `.copyable` rule (asserted by html.test.ts) stay in style.css.
 */

import { coerce, diff } from "semver";

import type { SecurityVulnerability } from "../../security/advisories";
import type { PolicyDecision } from "../../security/policies";
import { compareFindingsForDisplay } from "../../security/severity";
import ANOLILAB_LOGO from "../assets/anolilab-text.svg?raw";
// Compiled to the minified Tailwind CSS string by packem at build time; under
// vitest/tsx the import resolves via Vite's native CSS handling.
import styleCss from "./style.css";

const css = styleCss as unknown as string;

export interface AuditHtmlFinding {
    acknowledged: boolean;
    /** Optional AI explanation (from `--explain`), rendered in a collapsible row. */
    explanation?: string;
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
    /** Non-vulnerability policy decisions to render in a dedicated section. */
    policyDecisions?: PolicyDecision[];
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

/** Self-documenting word for the Upgrade column — replaces an unlabeled shape so the risk reads without a legend. */
const MARKER_TEXT: Record<BreakingMarker["kind"], string> = { major: "major bump", "minor-patch": "safe", unknown: "no fix" };

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
        } else if ((d === "minor" || d === "patch" || d === "preminor" || d === "prepatch") && !lowestMinorPatch) {
            // A bare "prerelease" diff (e.g. 1.0.0 → 1.0.0-rc.2) is not a
            // stable in-range fix, so it is intentionally excluded here.
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

/** Short, fixed labels for the structured `--explain` output. */
const INTEL_KEYS = new Map<string, string>([
    ["are you at risk", "RISK"],
    ["what it is", "VECTOR"],
    ["what to do", "ACTION"],
]);

/**
 * The explanation arrives as newline-separated `Label: value` lines (already
 * control-char sanitized upstream). Render each as a labelled intel line;
 * unrecognised / unstructured lines degrade to plain prose.
 */
const renderExplanation = (explanation: string): string =>
    explanation
        .split("\n")
        .map((raw) => {
            const line = raw.trim();

            if (!line) {
                return "";
            }

            // eslint-disable-next-line sonarjs/prefer-regexp-exec -- repo security hook blocks the RegExp#exec token; String#match is equivalent here (non-global regex, single match).
            const match = line.match(/^([^:]{2,40}):\s*(.+)$/u);

            if (match?.[1] && match[2]) {
                const tag = INTEL_KEYS.get(match[1].trim().toLowerCase()) ?? match[1].trim().toUpperCase();

                return `<div class="intel-line grid grid-cols-[72px_1fr] items-start gap-4"><span class="intel-key pt-0.5 text-[9px] font-bold uppercase">${escapeHtml(tag)}</span><span class="intel-val text-[13px]">${escapeHtml(match[2].trim())}</span></div>`;
            }

            return `<div class="intel-line intel-prose grid items-start gap-4"><span class="intel-val text-[13px]">${escapeHtml(line)}</span></div>`;
        })
        .join("");

/** Theme toggle icons — inlined Feather-style SVGs so rendering does not depend on a font that ships ☾/☀ glyphs. */
const MOON_ICON = `<svg class="ticon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_ICON = `<svg class="ticon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>`;

const TD_BASE = "px-3 py-3 text-left align-middle";
const TH_BASE = "sticky top-0 z-[2] px-3 py-3 text-left text-[10px] font-medium uppercase whitespace-nowrap select-none";
const POLICY_TH_BASE = "px-3 py-3 text-left text-[10px] font-medium uppercase";

const renderRow = (finding: AuditHtmlFinding): string => {
    const { acknowledged, explanation, packageName, packageVersion, remediation, vulnerability } = finding;
    const { severity } = vulnerability;
    const marker = breakingMarker(packageVersion, vulnerability.fixedVersions);
    const fix = vulnerability.fixedVersions.length > 0 ? vulnerability.fixedVersions.join(", ") : "—";
    // .copyable must keep `class="copyable"` literally (html.test.ts asserts the substring).
    const remediationCell = remediation
        ? `<code class="copyable" data-cmd="${escapeHtml(remediation)}" title="Click to copy">${escapeHtml(remediation)}</code>`
        : `<span class="muted">advisory only</span>`;
    const rowAttributes = `data-severity="${severity}" data-package="${escapeHtml(packageName)}" data-advisory="${escapeHtml(vulnerability.id)}"`;
    const rowClass = acknowledged ? "finding-row ack-row" : "finding-row";

    const mainRow = `<tr class="${rowClass}" ${rowAttributes}>
  <td class="sev-cell whitespace-nowrap ${TD_BASE}"><span class="badge badge-${severity.toLowerCase()} inline-flex items-center gap-[7px] rounded-[3px] py-1 pr-2 pl-[7px] text-[9px] font-bold uppercase">${severity}</span></td>
  <td class="${TD_BASE}"><span class="marker marker-${marker.kind} inline-block whitespace-nowrap align-middle text-[9px] font-bold uppercase" title="${escapeHtml(marker.label)}">${MARKER_TEXT[marker.kind]}</span></td>
  <td class="${TD_BASE}"><code class="pkg font-medium">${escapeHtml(packageName)}</code></td>
  <td class="${TD_BASE}"><code class="ver whitespace-nowrap">${escapeHtml(packageVersion)}</code></td>
  <td class="adv-cell whitespace-nowrap ${TD_BASE}"><a href="${escapeHtml(advisoryUri(vulnerability.id))}" class="text-[12px] no-underline" rel="noreferrer noopener" target="_blank">${escapeHtml(vulnerability.id)}</a>${acknowledged ? ` <span class="ack ml-2 inline-block px-[5px] py-px text-[9px] uppercase">acknowledged</span>` : ""}</td>
  <td class="summary-cell ${TD_BASE} min-w-[220px] text-[13px]">${escapeHtml(vulnerability.summary)}</td>
  <td class="${TD_BASE}"><code class="fix whitespace-nowrap">${escapeHtml(fix)}</code></td>
  <td class="${TD_BASE}">${remediationCell}</td>
</tr>`;

    if (!explanation) {
        return mainRow;
    }

    return `${mainRow}
<tr class="explain-row" ${rowAttributes}>
  <td colspan="8" class="p-0"><details><summary class="flex cursor-pointer items-center gap-3 px-3 py-2 select-none"><span class="intel-tag text-[9px] font-bold uppercase">[ AI INTEL ]</span><span class="intel-hint text-[9px] uppercase">threat analysis · click to expand</span></summary><div class="explain-body grid gap-3 px-3 pt-1 pb-4">${renderExplanation(explanation)}</div></details></td>
</tr>`;
};

/** Renders an audit run (vulnerabilities + non-vulnerability policy decisions) as a self-contained HTML report. */
export const emitAuditHtml = (options: AuditHtmlEmitOptions): string => {
    const now = options.now ?? new Date();
    const sortedFindings = [...options.findings].sort(compareFindingsForDisplay);

    const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, LOW: 0, MODERATE: 0, UNKNOWN: 0 };

    for (const finding of sortedFindings) {
        counts[finding.vulnerability.severity ?? "UNKNOWN"] += 1;
    }

    const rows = sortedFindings.map((f) => renderRow(f)).join("\n");

    const clean = sortedFindings.length === 0;

    const sevChips = SEVERITY_ORDER.filter((s) => counts[s] > 0).map(
        (s) =>
            `<div class="dseg dseg-sev dseg-${s.toLowerCase()}"><span class="dk text-[10px] font-medium uppercase">${s}</span><span class="dv text-[22px]">${String(counts[s])}</span></div>`,
    );

    // Scanned/findings read left; the per-severity counts are pushed to the
    // right edge as a static read-out (name + count, no interaction).
    const metricSegments = [
        `<div class="dseg"><span class="dk text-[10px] font-medium uppercase">scanned</span><span class="dv text-[22px]">${String(options.packagesScanned)}</span></div>`,
        `<div class="dseg"><span class="dk text-[10px] font-medium uppercase">findings</span><span class="dv text-[22px]"><span id="shown">${String(sortedFindings.length)}</span>${
            clean ? "" : `<span class="dvsep mx-1 font-light">/</span>${String(sortedFindings.length)}`
        }</span></div>`,
        sevChips.length > 0 ? `<span class="flex-auto"></span>` : "",
        ...sevChips,
        clean
            ? `<div class="dseg dseg-ok"><span class="dot inline-block size-[7px] self-center"></span><span class="dk text-[10px] font-medium uppercase">status</span><span class="dv text-[22px]">CLEAN</span></div>`
            : "",
    ].join("");

    const statusKind = clean ? "ok" : counts.CRITICAL > 0 ? "crit" : counts.HIGH > 0 ? "high" : "warn";

    const policyDecisions = (options.policyDecisions ?? []).filter((d) => d.policy !== "vulnerability");
    const policyRows = [...policyDecisions]
        .sort((a, b) => {
            const rank = (s: PolicyDecision["severity"]): number => (s === "block" ? 0 : s === "warn" ? 1 : 2);

            return rank(a.severity) - rank(b.severity) || a.policy.localeCompare(b.policy) || a.packageName.localeCompare(b.packageName);
        })
        .map((d) => {
            const acceptedMarker = d.acceptedRisk ? ` <span class="ack ml-2 inline-block px-[5px] py-px text-[9px] uppercase">[acknowledged]</span>` : "";

            return `<tr>
  <td class="px-3 py-3 align-top"><span class="policy-badge policy-${d.severity} inline-flex items-center gap-[7px] rounded-[3px] py-1 pr-2 pl-[7px] text-[10px] font-bold uppercase">${d.severity.toUpperCase()}</span></td>
  <td class="px-3 py-3 align-top"><code class="uppercase">${escapeHtml(d.policy)}</code></td>
  <td class="px-3 py-3 align-top"><code class="uppercase">${escapeHtml(d.packageName)}</code></td>
  <td class="px-3 py-3 align-top"><code class="uppercase">${escapeHtml(d.version)}</code></td>
  <td class="px-3 py-3 align-top">${escapeHtml(d.reason)}${acceptedMarker}</td>
</tr>`;
        })
        .join("\n");

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vis audit · ${escapeHtml(now.toISOString().slice(0, 10))}</title>
<style>${css}</style>
</head>
<body>
<main class="mx-auto max-w-[1080px]">
<header class="masthead flex flex-wrap items-end gap-4 px-0 pt-8 pb-5">
  <div class="brand leading-none tracking-tight">${(() => {
        const [head, ...rest] = options.tool.name.split("-");

        return rest.length > 0
            ? `${escapeHtml(head ?? options.tool.name)}<span class="slash mx-[0.12em] font-light">/</span>${escapeHtml(rest.join("-"))}`
            : escapeHtml(options.tool.name);
    })()}<span class="sub mt-3 block text-[11px] font-medium uppercase">dependency security report</span></div>
  <span class="flex-auto"></span>
  <span class="chip inline-flex h-7 items-center justify-center rounded-[4px] px-3 text-[11px] font-medium uppercase">v${escapeHtml(options.tool.version)}</span>
  <button id="theme" class="tbtn tbtn-theme inline-flex h-7 cursor-pointer items-center justify-center rounded-[4px] bg-transparent px-3 text-[11px] font-medium uppercase" type="button" aria-label="Toggle color theme" title="Toggle color theme"><span class="ticon ticon-moon inline-flex items-center justify-center">${MOON_ICON}</span><span class="ticon ticon-sun inline-flex items-center justify-center">${SUN_ICON}</span></button>
</header>
${
    clean
        ? ""
        : `<section class="verdict verdict-${statusKind} flex flex-wrap items-baseline gap-x-6 gap-y-1"><span class="vnum font-light">${String(sortedFindings.length)}</span><span class="vsub text-[12px] uppercase">${
            sortedFindings.length === 1 ? "vulnerability detected" : "vulnerabilities detected"
        }</span></section>`
}
<div class="debugbar flex flex-wrap items-stretch gap-0 pt-7 pb-1">${metricSegments}</div>
<div class="pt-8">
${
    clean
        ? `<div class="clean px-6 text-center"><div class="big font-light">CLEAN</div><div class="sub mt-6 text-[12px] uppercase">No security issues found.</div></div>`
        : `
<div class="mb-6 flex flex-wrap items-center gap-0">
  <label class="field flex flex-[1_1_280px] items-center"><span class="prompt pr-3 text-[10px] uppercase select-none">filter:</span><input id="filter" type="search" class="w-full border-0 bg-transparent py-2.5 pr-0 pl-0 text-[13px] outline-0" placeholder="package or advisory id…" aria-label="Filter findings" /></label>
  <label class="field sel flex flex-none items-center"><span class="prompt pr-3 text-[10px] uppercase select-none">sev</span><select id="severity" class="w-full cursor-pointer border-0 bg-transparent py-2.5 pr-6 pl-0 text-[13px] outline-0" aria-label="Filter by severity">
    <option value="">all severities</option>
    <option value="CRITICAL">critical only</option>
    <option value="HIGH">high and above</option>
    <option value="MODERATE">moderate and above</option>
    <option value="LOW">low and above</option>
  </select></label>
  <span class="hint ml-8 text-[10px] uppercase"><span class="kbd rounded-[3px] px-[6px] py-px text-[10px] font-medium uppercase">/</span> to search · <span class="kbd rounded-[3px] px-[6px] py-px text-[10px] font-medium uppercase">esc</span> to clear</span>
</div>
<table id="findings" class="w-full text-[13px]">
<thead>
<tr>
  <th class="${TH_BASE}">Severity</th>
  <th class="${TH_BASE}">Upgrade</th>
  <th class="${TH_BASE}">Package</th>
  <th class="${TH_BASE}">Version</th>
  <th class="${TH_BASE}">Advisory</th>
  <th class="${TH_BASE}">Summary</th>
  <th class="${TH_BASE}">Fix</th>
  <th class="${TH_BASE}">Remediation</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
<div id="empty" class="empty hidden px-5 py-12 text-center text-[12px] uppercase">No findings match the current filter.</div>`
}
${
    policyDecisions.length > 0
        ? `
<h2>Policy Decisions (${policyDecisions.length})</h2>
<table id="policies" class="w-full text-[13px]">
<thead>
<tr>
  <th class="${POLICY_TH_BASE}">Severity</th>
  <th class="${POLICY_TH_BASE}">Policy</th>
  <th class="${POLICY_TH_BASE}">Package</th>
  <th class="${POLICY_TH_BASE}">Version</th>
  <th class="${POLICY_TH_BASE}">Reason</th>
</tr>
</thead>
<tbody>
${policyRows}
</tbody>
</table>`
        : ""
}
<footer class="sig mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-5 text-[10px] uppercase"><span class="sig-meta"><b>${escapeHtml(options.tool.name)}</b> ${escapeHtml(options.tool.version)} · generated ${escapeHtml(now.toISOString())} · powered by OSV.dev</span><span class="sig-by inline-flex items-center gap-2"><span class="sig-by-label">built by</span><a class="sig-by-link inline-flex items-center" href="https://anolilab.com" rel="noreferrer noopener" target="_blank" aria-label="Anolilab">${ANOLILAB_LOGO}</a></span></footer>
</div>
</main>
<script>
(() => {
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme');
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  // Theme: persisted choice wins, else follow OS. JS only flips data-theme;
  // CSS handles the colors and the moon/sun icon swap.
  try {
    const stored = localStorage.getItem('vis-audit-theme');
    if (stored === 'light' || stored === 'dark') {
      root.dataset.theme = stored;
    }
  } catch {}

  themeBtn?.addEventListener('click', () => {
    const isDark = root.dataset.theme ? root.dataset.theme === 'dark' : mql.matches;
    const next = isDark ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('vis-audit-theme', next);
    } catch {}
  });

  // Filter index: read each row's data-* once, lowercase strings ahead of
  // time, and pre-rank severity. Subsequent keystrokes only compare cached
  // primitives — no per-row getAttribute / toLowerCase in the hot loop.
  const RANK = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3, UNKNOWN: 4 };
  const UNKNOWN = RANK.UNKNOWN;
  const filterInput = document.getElementById('filter');
  const sevSelect = document.getElementById('severity');
  const shown = document.getElementById('shown');
  const empty = document.getElementById('empty');
  const index = [];
  for (const el of document.querySelectorAll('#findings tbody tr')) {
    const d = el.dataset;
    index.push({
      el,
      pkg: (d.package || '').toLowerCase(),
      adv: (d.advisory || '').toLowerCase(),
      rank: RANK[d.severity] ?? UNKNOWN,
      finding: el.classList.contains('finding-row'),
      hidden: false,
    });
  }
  let emptyShown = false;

  const apply = () => {
    const q = (filterInput?.value || '').toLowerCase().trim();
    const sevValue = sevSelect?.value || '';
    const cap = sevValue ? (RANK[sevValue] ?? UNKNOWN) : UNKNOWN;
    let visible = 0;
    for (const row of index) {
      const queryHit = !q || row.pkg.includes(q) || row.adv.includes(q);
      const sevHit = !sevValue || row.rank <= cap;
      const visibleNow = queryHit && sevHit;
      if (visibleNow && row.finding) {
        visible += 1;
      }
      // Only touch the DOM when this row's state actually changes — keeps
      // continued typing from re-laying out every row on every keystroke.
      if (visibleNow === !row.hidden) {
        continue;
      }
      row.el.style.display = visibleNow ? '' : 'none';
      row.hidden = !visibleNow;
    }
    if (shown) {
      shown.textContent = String(visible);
    }
    const showEmpty = visible === 0;
    if (empty && showEmpty !== emptyShown) {
      empty.style.display = showEmpty ? 'block' : 'none';
      emptyShown = showEmpty;
    }
  };

  // Coalesce typing-driven updates to one pass per frame; rapid keystrokes
  // (paste, IME) collapse into a single filter sweep.
  let pending = 0;
  const scheduleApply = () => {
    if (pending) {
      return;
    }
    pending = requestAnimationFrame(() => {
      pending = 0;
      apply();
    });
  };

  filterInput?.addEventListener('input', scheduleApply);
  sevSelect?.addEventListener('change', apply);

  // Keyboard: "/" focuses the filter, Esc clears every active filter.
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== filterInput) {
      event.preventDefault();
      filterInput?.focus();
      return;
    }
    if (event.key === 'Escape') {
      if (filterInput) {
        filterInput.value = '';
      }
      if (sevSelect) {
        sevSelect.value = '';
      }
      apply();
      filterInput?.blur();
    }
  });

  // Click-to-copy on remediation command bars (event-delegated).
  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('.copyable');
    // Guard re-entry during the 1s revert: a second click would otherwise
    // capture "✓ copied to clipboard" as the original and never restore it.
    if (!target || target.classList.contains('copied')) {
      return;
    }
    const cmd = target.dataset.cmd ?? target.textContent ?? '';
    navigator.clipboard?.writeText(cmd).then(() => {
      const orig = target.textContent;
      target.classList.add('copied');
      target.textContent = '✓ copied to clipboard';
      setTimeout(() => {
        target.textContent = orig;
        target.classList.remove('copied');
      }, 1000);
    }).catch(() => {});
  });

  apply();
})();
</script>
</body>
</html>
`;
};
