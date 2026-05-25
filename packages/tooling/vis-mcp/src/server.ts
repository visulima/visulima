import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findUp } from "@visulima/fs";

import type { ToolContext, ToolDeps } from "./response";
import { registerAdvisoryStatus } from "./tools/advisory-status";
import { registerAudit } from "./tools/audit";
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
 * Resolve the user's installed `vis` CLI from a workspace root. Tries the
 * workspace's `node_modules` first (the install-time path used by consumers
 * of `@visulima/vis` + `@visulima/vis-mcp`), then falls back to `vis-mcp`'s
 * own install directory to pick up pnpm-workspace symlinks and peerDep
 * hoisting when the workspace root itself doesn't declare a direct dep on
 * vis. `VIS_MCP_VIS_BIN` short-circuits both for linked checkouts or
 * custom layouts where neither resolution succeeds.
 */
const resolveVisBin = (workspaceRoot: string): string => {
    const override = process.env.VIS_MCP_VIS_BIN;

    if (override) {
        return resolve(override);
    }

    const candidates: { label: string; require: ReturnType<typeof createRequire> }[] = [
        { label: workspaceRoot, require: createRequire(pathToFileURL(`${workspaceRoot}/package.json`)) },
        { label: "vis-mcp install location", require: createRequire(import.meta.url) },
    ];

    const errors: { error: unknown; label: string }[] = [];
    let visPkgJsonPath: string | undefined;
    let visPkg: PackageJsonShape | undefined;

    for (const { label, require: request } of candidates) {
        try {
            visPkgJsonPath = request.resolve("@visulima/vis/package.json");
            visPkg = request("@visulima/vis/package.json") as PackageJsonShape;
            break;
        } catch (error) {
            errors.push({ error, label });
        }
    }

    if (!visPkgJsonPath || !visPkg) {
        const lastError = errors.at(-1)?.error;
        const tried = errors.map((entry) => entry.label).join(", ");

        throw new Error(`Cannot resolve \`@visulima/vis\` (tried: ${tried}). Install it as a workspace dependency, or set VIS_MCP_VIS_BIN to a vis CLI path.`, {
            cause: lastError,
        });
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
    registerAudit(deps, context);
    registerAdvisoryStatus(deps, context);
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
