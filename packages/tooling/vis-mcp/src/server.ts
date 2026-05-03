import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findUp } from "@visulima/fs";

import type { ToolContext, ToolDeps } from "./response";
import { registerCacheHash } from "./tools/cache-hash";
import { registerCacheWhy } from "./tools/cache-why";
import { registerDescribeProject } from "./tools/describe-project";
import { registerDescribeTemplate } from "./tools/describe-template";
import { registerGetRunLogs } from "./tools/get-run-logs";
import { registerListProjects } from "./tools/list-projects";
import { registerListTargets } from "./tools/list-targets";
import { registerListTemplates } from "./tools/list-templates";

interface PackageJsonShape {
    bin?: Record<string, string> | string;
    version?: string;
}

/**
 * Resolve the user's installed `@visulima/vis` CLI from a workspace root.
 * `createRequire` honours that workspace's `node_modules`, so a globally
 * installed `vis-mcp` still finds the project-local vis. Falls back to
 * `VIS_MCP_VIS_BIN` for environments where the package isn't resolvable
 * (linked checkouts, custom monorepos).
 */
const resolveVisBin = (workspaceRoot: string): string => {
    const override = process.env.VIS_MCP_VIS_BIN;

    if (override) {
        return resolve(override);
    }

    const requireFromWorkspace = createRequire(pathToFileURL(`${workspaceRoot}/package.json`));

    let visPkgJsonPath: string;
    let visPkg: PackageJsonShape;

    try {
        visPkgJsonPath = requireFromWorkspace.resolve("@visulima/vis/package.json");
        visPkg = requireFromWorkspace("@visulima/vis/package.json") as PackageJsonShape;
    } catch (error) {
        throw new Error(
            `Cannot resolve \`@visulima/vis\` from ${workspaceRoot}. Install it as a workspace dependency, or set VIS_MCP_VIS_BIN to a vis CLI path.`,
            { cause: error },
        );
    }

    const binEntry = typeof visPkg.bin === "string" ? visPkg.bin : visPkg.bin?.vis;

    if (!binEntry) {
        throw new Error("`@visulima/vis` is installed but does not declare a `vis` bin entry — install a current version.");
    }

    return resolve(dirname(visPkgJsonPath), binEntry);
};

const loadVersion = async (): Promise<string> => {
    try {
        // findUp walks parents so this resolves the same way whether we're
        // running from `dist/bin.js` (production) or `src/server.ts` (vitest)
        // — both end up at the package root.
        const packageJsonPath = await findUp("package.json", { cwd: dirname(fileURLToPath(import.meta.url)) });

        if (!packageJsonPath) {
            return "0.0.0";
        }

        const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJsonShape;

        return parsed.version ?? "0.0.0";
    } catch (error) {
        process.stderr.write(`[vis-mcp] failed to read package.json: ${error instanceof Error ? error.message : String(error)}\n`);

        return "0.0.0";
    }
};

/**
 * Register every tool against an already-built MCP server. Pure wiring — no
 * I/O — so tests can drive it against an `InMemoryTransport` without forking
 * a subprocess.
 */
export const registerAllTools = (deps: ToolDeps, context: ToolContext): void => {
    registerListProjects(deps, context);
    registerDescribeProject(deps, context);
    registerListTargets(deps, context);
    registerListTemplates(deps, context);
    registerDescribeTemplate(deps, context);
    registerGetRunLogs(deps, context);
    registerCacheWhy(deps, context);
    registerCacheHash(deps, context);
};

/**
 * Build a fully-configured MCP server with all vis tools registered. Returns
 * the server and deps so callers can connect any transport. Tests use this
 * with `InMemoryTransport.createLinkedPair()`.
 */
export const createMcpServer = async (context: ToolContext): Promise<{ deps: ToolDeps; server: McpServer }> => {
    const server = new McpServer({
        name: "vis",
        version: await loadVersion(),
    });

    const deps: ToolDeps = { server };

    registerAllTools(deps, context);

    return { deps, server };
};

/**
 * Boot the vis MCP server over stdio.
 *
 * Critical invariant: nothing in this process may write to stdout outside
 * the MCP transport. Any console.log in tool handlers will frame-corrupt
 * the JSON-RPC stream. Logs go to stderr only.
 */
export const startMcpServer = async (): Promise<void> => {
    const workspaceRoot = process.env.VIS_MCP_WORKSPACE_ROOT ?? process.cwd();

    const context: ToolContext = {
        visBin: resolveVisBin(workspaceRoot),
        workspaceRoot,
    };

    const { server } = await createMcpServer(context);

    await server.connect(new StdioServerTransport());

    process.stderr.write(`[vis-mcp] ready (workspace: ${context.workspaceRoot})\n`);
};
