import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The React dashboard lives in `packages/tooling/vis/dashboard/` as a
 * Vite + shadcn/ui project and is compiled to a single self-contained
 * `index.html` by `vite-plugin-singlefile`. At runtime we serve that
 * file verbatim.
 *
 * Two lookup paths are tried in order:
 *
 * 1. `../../dashboard/dist/index.html` relative to this module's
 *    source location (dev builds run `vis` directly from `src/`).
 * 2. `../dashboard/dist/index.html` relative to the bundled
 *    `dist/bin.js` (production install — the `dashboard/dist/` folder
 *    ships alongside `dist/` as a sibling directory).
 */

const here = dirname(fileURLToPath(import.meta.url));

const CANDIDATES = [
    resolve(here, "..", "..", "dashboard", "dist", "index.html"),
    resolve(here, "..", "dashboard", "dist", "index.html"),
];

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>vis dashboard</title>
<style>
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; background: #0b0d12; color: #e6e9f2; padding: 40px; max-width: 640px; margin: 0 auto; }
  code { background: #181c2b; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; }
  a { color: #7c9eff; }
</style>
</head>
<body>
  <h1>vis dashboard — not built yet</h1>
  <p>The dashboard UI bundle is missing. Build it from the package root:</p>
  <pre><code>pnpm --filter @visulima/vis-dashboard run build</code></pre>
  <p>Or run the full vis build:</p>
  <pre><code>pnpm --filter @visulima/vis run build</code></pre>
</body>
</html>`;

let cached: string | undefined;

const findBuiltHtml = (): string | undefined => {
    for (const candidate of CANDIDATES) {
        try {
            if (statSync(candidate).isFile()) {
                return candidate;
            }
        } catch {
            // Path missing — try the next candidate.
        }
    }

    return undefined;
};

/**
 * Returns the HTML shell served at `/` by the dashboard server.
 *
 * The result is cached for the lifetime of the process — the dashboard
 * UI is a single built artifact, so re-reading it on every request
 * would be wasted I/O. Set `VIS_DASHBOARD_NO_CACHE=1` to re-read on
 * every call during iterative frontend development.
 */
export const renderDashboardHtml = (): string => {
    if (cached !== undefined && !process.env.VIS_DASHBOARD_NO_CACHE) {
        return cached;
    }

    const path = findBuiltHtml();

    if (!path) {
        cached = FALLBACK_HTML;

        return cached;
    }

    try {
        const html = readFileSync(path, "utf8");

        cached = html;

        return html;
    } catch {
        cached = FALLBACK_HTML;

        return cached;
    }
};
