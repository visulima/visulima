import { realpathSync } from "node:fs";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";

import { startMcpServer } from "./server";

/**
 * Entry point for the published `vis-mcp` binary. Extracted into a named
 * function so it can be unit-tested in-process — V8 coverage instrumentation
 * does not cross the child-process boundary, so a top-level await in this
 * file would always read as 0% coverage in CI.
 *
 * The auto-invoke at the bottom of this file is gated on `import.meta.url`
 * matching `process.argv[1]` so that `await import("./bin")` from a test
 * does not spawn the MCP server twice.
 */
const main = async (): Promise<void> => {
    try {
        await startMcpServer();
    } catch (error: unknown) {
        process.stderr.write(`[vis-mcp] failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exit(1);
    }
};

/* v8 ignore start -- CLI dispatch guard; covered by the integration spawn test, not by in-process coverage */
// Node's ESM loader realpaths the module URL while `process.argv[1]` keeps the
// un-resolved launch path, so a strict compare is false whenever the binary is
// reached through a symlink — the `node_modules/.bin` shim, `npx vis-mcp`, or an
// MCP client `command: "vis-mcp"`. Resolve both sides through `realpathSync`
// (es-main pattern) so the standard launch paths still boot the server.
const isDirectInvocation = ((): boolean => {
    const entry = argv[1];

    if (entry === undefined) {
        return false;
    }

    try {
        return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
})();

if (isDirectInvocation) {
    await main();
}
/* v8 ignore stop */

export { main };
