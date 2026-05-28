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
const isDirectInvocation = argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isDirectInvocation) {
    await main();
}
/* v8 ignore stop */

export { main };
