/**
 * `vis release next-version` — read-only printer for the next computed
 * version of each package in the release plan (semantic-release #753 /
 * #1647 parity).
 *
 * Pure read flow:
 *   1. Build context with `skipRegistryLookup: true` — we don't need
 *      the version-actions to phone home; the on-disk manifest is
 *      sufficient for "what would a `vis release version` produce?".
 *   2. The release plan is already assembled by `buildContext`. We
 *      project it down to `{ oldVersion, newVersion }` per package,
 *      filter by `--package` when set, and emit pretty lines or JSON.
 *   3. No mutations: no change files are written, no tags moved, no
 *      registry probed. Calling this is always safe.
 *
 * Empty plan → exit 0 with no output (the operator was asking a
 * question; "nothing to release" is a legitimate answer, not an error).
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../release/core/orchestrator";
import type { ReleaseNextVersionOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseNextVersionOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    // F21: forward --first-release so greenfield users can preview the
    // bootstrap plan without registry / tag lookups producing false
    // collisions. The boolean === true narrowing is intentional — cerebro
    // may surface the option as `undefined` when unset.
    const ctx = await buildContext({
        channel: options.channel,
        cwd,
        firstRelease: options.firstRelease === true,
        skipRegistryLookup: true,
    });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    // Filter to a single package when --package is set. We match by
    // exact package name only; ambiguous globs are out of scope for
    // a question-style command.
    const filter = options.package;
    const releases = filter
        ? ctx.plan.releases.filter((r) => r.name === filter)
        : ctx.plan.releases;

    if (releases.length === 0) {
        // F11: when the operator supplied `--package <name>` and the
        // filter matched nothing, exit non-zero so CI scripts can
        // distinguish "no bump needed" from "wrong / missing package
        // name". Without --package, an empty plan is a legitimate
        // answer (no releases pending) and we keep exit code 0.
        if (filter !== undefined && filter !== "") {
            const known = new Set(ctx.plan.releases.map((r) => r.name));
            const inPlan = known.has(filter);
            const inWorkspace = ctx.packages.some((p) => p.name === filter);

            let reason: string;

            if (inPlan) {
                // Defensive — should be unreachable since releases.length === 0.
                reason = `release plan unexpectedly empty for "${filter}"`;
            } else if (inWorkspace) {
                reason = `package "${filter}" is in the workspace but has no pending release (no change file targets it).`;
            } else {
                const sample = ctx.packages.slice(0, 5).map((p) => p.name).join(", ");
                const hint = sample
                    ? ` Known workspace packages: ${sample}${ctx.packages.length > 5 ? ", …" : ""}.`
                    : "";

                reason = `package "${filter}" is not in this workspace.${hint}`;
            }

            logger.error(`--package filter matched no releases: ${reason}`);

            // F11: when `--json` is set, emit a parseable empty object on
            // stdout before bailing. CI pipelines that always pipe stdout
            // through `JSON.parse` would otherwise crash with a cryptic
            // syntax error and obscure the real cause (the operator's
            // missing / typo'd package name). Exit code stays 1 — the
            // empty payload is just a structural courtesy for JSON
            // consumers; the non-zero exit is the signal.
            if (options.json) {
                process.stdout.write(`${JSON.stringify({ error: reason }, null, 2)}\n`);
            }

            process.exitCode = 1;

            return;
        }

        // Empty plan → no output. The operator can detect this by
        // process.exitCode === 0 with empty stdout (or `--json` → `{}`).
        if (options.json) {
            process.stdout.write("{}\n");
        }

        return;
    }

    if (options.json) {
        const map: Record<string, { from: string; to: string }> = {};

        for (const r of releases) {
            map[r.name] = { from: r.oldVersion, to: r.newVersion };
        }

        process.stdout.write(`${JSON.stringify(map, null, 2)}\n`);

        return;
    }

    // Pretty lines — one `<name> <old> -> <new>` per release. Stdout
    // directly so the output can be piped through `grep` / `awk` without
    // logger metadata interfering. Sorted by name for stable diffs.
    const sorted = [...releases].sort((a, b) => a.name.localeCompare(b.name));

    for (const r of sorted) {
        process.stdout.write(`${r.name} ${r.oldVersion} -> ${r.newVersion}\n`);
    }
};

export default execute as CommandExecute<Toolbox>;
