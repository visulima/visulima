/**
 * Dev-only visual QA for the `vis audit` HTML report.
 *
 * The report stylesheet is a Tailwind entry that only gets compiled by
 * packem's inline-CSS pipeline. This script builds the package first, lifts
 * the *compiled* CSS straight out of the packem build output (packem inlines
 * it as a `var css = "…"` JS string literal whose body opens with the
 * `/*! tailwindcss vX *​/` banner), then esbuild-assembles the report markup
 * with that exact CSS. The screenshots therefore show the real compiled CSS
 * users see — esbuild only stitches the HTML, it never recompiles Tailwind.
 *
 *   node scripts/screenshot-audit.mjs            # build, then shoot
 *   node scripts/screenshot-audit.mjs --no-build # reuse existing dist
 *
 * Outputs: /tmp/vis-audit-sample.html and /tmp/vis-audit-{light,dark}.png
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "../../../../node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const require = createRequire(import.meta.url);

if (!process.argv.includes("--no-build")) {
    process.stdout.write("Building @visulima/vis (packem)…\n");
    execFileSync("pnpm", ["--filter", "@visulima/vis", "run", "build"], { cwd: resolve(pkgRoot, "../../.."), stdio: "inherit" });
}

const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);

        return e.isDirectory() ? walk(p) : p;
    });

// Tailwind v4 hoists every `/*! … */` banner to the top of its output, so a
// pair of sentinel comments can't bracket the rules. Instead we anchor on the
// Tailwind license banner — it's the first byte of the compiled CSS — and walk
// the enclosing double-quoted JS string literal (escapes honored) to its end.
const BANNER = "/*! tailwindcss v";

const extractCompiledCss = () => {
    for (const file of walk(resolve(pkgRoot, "dist")).filter((p) => p.endsWith(".js"))) {
        const source = readFileSync(file, "utf8");
        const bannerIdx = source.indexOf(BANNER);

        if (bannerIdx === -1) {
            continue;
        }

        // packem emits `… = "<banner>…"`, so the opening quote sits right
        // before the banner.
        const open = source.lastIndexOf('"', bannerIdx);

        if (open === -1 || source.slice(open + 1, open + 1 + BANNER.length) !== BANNER) {
            continue;
        }

        let index = open + 1;

        for (; index < source.length; index += 1) {
            const ch = source[index];

            if (ch === "\\") {
                index += 1;
            } else if (ch === '"') {
                break;
            }
        }

        return JSON.parse(source.slice(open, index + 1));
    }

    throw new Error("Compiled Tailwind CSS not found in dist — run a full `pnpm --filter @visulima/vis build` first.");
};

const compiledCss = extractCompiledCss();

const esbuild = require("esbuild");

const cssAsString = {
    name: "css-as-string",
    setup(build) {
        build.onLoad({ filter: /\.css$/ }, () => ({ contents: `export default ${JSON.stringify(compiledCss)};`, loader: "js" }));
    },
};

const bundle = await esbuild.build({
    bundle: true,
    format: "esm",
    platform: "node",
    plugins: [cssAsString],
    stdin: {
        contents: `export { emitAuditHtml } from ${JSON.stringify(resolve(pkgRoot, "src/report/audit/html.ts"))};`,
        loader: "ts",
        resolveDir: pkgRoot,
    },
    write: false,
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`;
const { emitAuditHtml } = await import(moduleUrl);

const html = emitAuditHtml({
    findings: [
        {
            acknowledged: false,
            explanation:
                "What it is: A prototype pollution flaw in lodash where deeply nested merge/set operations can write to Object.prototype, letting attacker-controlled keys like __proto__ leak onto every object.\nAre you at risk: Only if you call _.merge/_.set/_.zipObjectDeep with untrusted input (e.g. a parsed request body). Merely having lodash in the lockfile is not exploitation.\nWhat to do: Upgrade lodash to 4.17.21 or later; if you cannot, validate/strip __proto__, constructor and prototype keys before passing objects into the affected APIs.",
            packageName: "lodash",
            packageVersion: "4.17.20",
            remediation: "pnpm up lodash@4.17.21",
            vulnerability: {
                aliases: ["CVE-2021-23337"],
                cvssScore: 7.2,
                fixedVersions: ["4.17.21"],
                id: "GHSA-35jh-r3h4-6jhm",
                severity: "HIGH",
                summary: "Command injection in lodash via template",
            },
        },
        {
            acknowledged: false,
            explanation:
                "What it is: minimist before 1.2.6 does not block __proto__ in argument parsing, so crafted CLI args can pollute Object.prototype.\nAre you at risk: Exposed only when you parse untrusted argv-shaped input with minimist. Most build-time CLI usage with developer-controlled flags is not affected.\nWhat to do: Upgrade minimist to 1.2.8.",
            packageName: "minimist",
            packageVersion: "1.2.5",
            remediation: "pnpm up minimist@1.2.8",
            vulnerability: {
                aliases: ["CVE-2021-44906"],
                cvssScore: 9.8,
                fixedVersions: ["1.2.6"],
                id: "GHSA-xvch-5gv4-984h",
                severity: "CRITICAL",
                summary: "Prototype pollution in minimist",
            },
        },
        {
            acknowledged: true,
            packageName: "semver",
            packageVersion: "5.7.1",
            remediation: "pnpm up semver@7.5.2",
            vulnerability: {
                aliases: ["CVE-2022-25883"],
                cvssScore: 5.3,
                fixedVersions: ["7.5.2"],
                id: "GHSA-c2qf-rxjj-qqgw",
                severity: "MODERATE",
                summary: "Regular expression denial of service in semver",
            },
        },
    ],
    now: new Date("2026-05-19T16:30:00Z"),
    packagesScanned: 412,
    tool: { name: "vis-audit", version: "alpha" },
    workspaceRoot: pkgRoot,
});

const htmlPath = "/tmp/vis-audit-sample.html";

writeFileSync(htmlPath, html, "utf8");
process.stdout.write(`${htmlPath}\n`);

const browser = await chromium.launch();

for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({ colorScheme: scheme, deviceScaleFactor: 2, viewport: { height: 900, width: 1280 } });

    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
    await page.evaluate((s) => {
        document.documentElement.dataset.theme = s;
    }, scheme);
    await page.waitForTimeout(400);

    const details = page.locator("details").first();

    if (await details.count()) {
        await details.evaluate((d) => d.setAttribute("open", ""));
    }

    await page.waitForTimeout(300);

    const out = `/tmp/vis-audit-${scheme}.png`;

    await page.screenshot({ fullPage: true, path: out });
    process.stdout.write(`${out}\n`);
    await page.close();
}

await browser.close();
