#!/usr/bin/env node

/**
 * MCP server for `@visulima/dev-toolbar` annotations.
 *
 * Usage:
 *   npx visulima-dev-toolbar-mcp
 *
 * Configure in .mcp.json:
 *   {
 *     "mcpServers": {
 *       "dev-toolbar": {
 *         "command": "npx",
 *         "args": ["visulima-dev-toolbar-mcp"],
 *         "cwd": "/absolute/path/to/project"
 *       }
 *     }
 *   }
 *
 * Requires @modelcontextprotocol/sdk to be installed.
 */

// eslint-disable-next-line antfu/no-import-dist, import/no-unresolved -- bin entry point runs after build
import { startMcpServer } from "../dist/mcp/server";

startMcpServer().catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
});
