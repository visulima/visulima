// Thin entry dispatcher. Keeps only the universal early setup that must run
// before ANY command, then lazy-loads the right code path. Lightweight commands
// (notably `vis x`) take a lean fast-path and never import the full CLI module
// graph (cerebro + 60 commands + plugins) — the dominant ~180ms of cold-start.
import enableCompileCache from "@visulima/cerebro/compile-cache";
import { applyHeapTuning } from "@visulima/cerebro/heap-tuning";

import { injectVersion } from "./io/terminal";

// `applyHeapTuning()` re-execs Node with a bumped --max-old-space-size (~290ms,
// a full extra process boot). Skip it for commands that do no heavy in-process
// work (version/help/completion, the pure dispatchers dlx/exec, and the lean
// file runner x); heavy commands (run, cache, audit, sbom, graph, …) keep the
// bump. Deny-list, so any unlisted/new command defaults to tuned — safe.
const HEAP_TUNING_SKIP = new Set(["", "--help", "--version", "-h", "-v", "completion", "dlx", "exec", "x"]);
const firstArgument = process.argv[2] ?? "";

if (!HEAP_TUNING_SKIP.has(firstArgument) && !process.argv.includes("--help") && !process.argv.includes("-h")) {
    applyHeapTuning();
}

// Honor --no-color before any colorized output is emitted.
if (process.argv.includes("--no-color")) {
    process.env["NO_COLOR"] = "1";
    process.env["FORCE_COLOR"] = "0";
}

// Inject VIS_VERSION for child processes before any command runs.
injectVersion();

// Enable V8 compile cache for faster subsequent startups.
enableCompileCache();

// Dispatch. `vis x` runs the target file in-process via a lean path that skips
// constructing the full CLI; everything else loads the full CLI lazily. Wrapped
// in an IIFE so there is no top-level await (Node 22 warns on unsettled TLA when
// cerebro's plugin lifecycle keeps a microtask in flight as the loop empties).
// eslint-disable-next-line unicorn/prefer-top-level-await, no-void -- the IIFE avoids Node's "unsettled top-level await" warning; void discards the promise
void (async () => {
    if (firstArgument === "x") {
        const { runLeanX } = await import("./commands/x/lean");

        await runLeanX(process.argv.slice(3));

        return;
    }

    // exec / dlx are pure child-dispatchers — take the lean entry (no 60-command
    // CLI, no config/security/post plugins, which don't apply to them).
    if (firstArgument === "exec" || firstArgument === "dlx") {
        const { runExecCli } = await import("./cli-exec");

        await runExecCli();

        return;
    }

    const { runCli } = await import("./cli-main");

    await runCli();
})();
