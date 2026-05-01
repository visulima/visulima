import { startMcpServer } from "./server";

try {
    await startMcpServer();
} catch (error: unknown) {
    process.stderr.write(`[vis-mcp] failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
}
